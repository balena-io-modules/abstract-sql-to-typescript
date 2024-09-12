import type {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlTable,
	InNode,
	Relationship,
	RelationshipInternalNode,
	RelationshipLeafNode,
} from '@balena/abstract-sql-compiler';
import { sqlNameToODataName } from '@balena/odata-to-abstract-sql';
import { replaceResultTransformer, TemplateTag } from 'common-tags';

import { version } from '../package.json';

type RequiredModelSubset = Pick<
	AbstractSqlModel,
	'tables' | 'relationships' | 'synonyms'
>;

const trimNL = new TemplateTag(
	replaceResultTransformer(/^[\r\n]*|[\r\n]*$/g, ''),
);

const modelNameToCamelCaseName = (s: string): string =>
	s
		.split(/[ -]/)
		.map((p) => p[0].toLocaleUpperCase() + p.slice(1))
		.join('');

const getReferencedInterface = (modelName: string, mode: Mode) =>
	`${modelNameToCamelCaseName(modelName)}['${mode}']`;

const sqlTypeToTypescriptType = (
	m: RequiredModelSubset,
	f: AbstractSqlField,
	mode: Mode,
): string => {
	if (!['ForeignKey', 'ConceptType'].includes(f.dataType) && f.checks) {
		const inChecks = f.checks.find(
			(checkTuple): checkTuple is InNode => checkTuple[0] === 'In',
		);
		if (inChecks) {
			const [, , ...allowedValues] = inChecks;
			return allowedValues
				.map(([type, value]) => (type === 'Text' ? `'${value}'` : value))
				.join(' | ');
		}
	}

	switch (f.dataType) {
		case 'ConceptType':
		case 'ForeignKey': {
			const referencedInterface = getReferencedInterface(
				m.tables[f.references!.resourceName].name,
				mode,
			);
			const referencedFieldType = `${referencedInterface}['${f.references!.fieldName}']`;
			if (mode === 'Write') {
				return referencedFieldType;
			}

			const nullable = f.required ? '' : ' | []';
			return `{ __id: ${referencedFieldType} } | [${referencedInterface}]${nullable}`;
		}
		default:
			return `Types['${f.dataType}']['${mode}']`;
	}
};

const fieldToInterfaceProps = (
	key: string,
	m: RequiredModelSubset,
	f: AbstractSqlField,
	mode: Mode,
): string | undefined => {
	if (mode === 'Write' && f.computed != null) {
		// Computed terms cannot be written to
		return;
	}
	const nullable = f.required ? '' : ' | null';
	return `${sqlNameToODataName(key)}: ${sqlTypeToTypescriptType(
		m,
		f,
		mode,
	)}${nullable};`;
};

const fieldsToInterfaceProps = (
	m: RequiredModelSubset,
	fields: AbstractSqlField[],
	mode: Mode,
): string[] =>
	fields
		.map((f) => fieldToInterfaceProps(f.fieldName, m, f, mode))
		.filter((f) => f != null);

const getSynonyms = (
	s: string,
	inverseSynonyms: Record<string, string>,
): string[] => {
	const synonyms: string[] = [];
	for (const inverseSynonym of Object.keys(inverseSynonyms)) {
		if (s.includes(inverseSynonym)) {
			synonyms.push(s.replace(inverseSynonym, inverseSynonyms[inverseSynonym]));
		}
	}
	return synonyms;
};

const recurseRelationships = (
	m: RequiredModelSubset,
	relationships: Relationship,
	inverseSynonyms: Record<string, string>,
	mode: Mode,
	currentTable: AbstractSqlTable,
	parentKey: string,
): string[] =>
	Object.keys(relationships).flatMap((key) => {
		if (key === '$') {
			const [localField, referencedField] = (
				relationships as RelationshipLeafNode
			).$;
			if (referencedField != null) {
				if (currentTable.idField === localField) {
					const referencedTable = m.tables[referencedField[0]];
					if (referencedTable != null) {
						const referencedInterface = getReferencedInterface(
							referencedTable.name,
							mode,
						);
						const propDefinitons = [
							`${sqlNameToODataName(parentKey)}?: Array<${referencedInterface}>;`,
						];
						const synonyms = getSynonyms(parentKey, inverseSynonyms);
						if (synonyms.length > 0) {
							for (const synonym of synonyms) {
								propDefinitons.push(
									`${sqlNameToODataName(synonym)}?: Array<${referencedInterface}>;`,
								);
							}
						}
						return propDefinitons;
					}
				} else {
					const f = currentTable.fields.find(
						({ fieldName }) => fieldName === localField,
					)!;
					const propDefinitons: string[] = [];
					const addDefinition = (propName: string) => {
						// Only add the relationship if it doesn't directly match the field name to avoid duplicates
						if (f.fieldName !== propName) {
							const propDefiniton = fieldToInterfaceProps(propName, m, f, mode);
							if (propDefiniton != null) {
								propDefinitons.push(propDefiniton);
							}
						}
					};
					addDefinition(parentKey);
					const synonyms = getSynonyms(parentKey, inverseSynonyms);
					if (synonyms.length > 0) {
						for (const synonym of synonyms) {
							addDefinition(synonym);
						}
					}
					return propDefinitons;
				}
			}
			return [];
		}
		return recurseRelationships(
			m,
			(relationships as RelationshipInternalNode)[key],
			inverseSynonyms,
			mode,
			currentTable,
			`${parentKey}-${key}`,
		);
	});

const relationshipsToInterfaceProps = (
	m: RequiredModelSubset,
	table: AbstractSqlTable,
	mode: Mode,
): string[] => {
	const relationships = m.relationships[table.resourceName];
	if (relationships == null) {
		return [];
	}
	return Object.keys(relationships).flatMap((key) => {
		// We skip `has` a the top level as we omit it by convention
		if (key === 'has') {
			return [];
		}
		const inverseSynonyms = Object.fromEntries(
			Object.entries(m.synonyms).map(([termForm, factType]) => [
				factType,
				termForm,
			]),
		);
		return recurseRelationships(
			m,
			relationships[key],
			inverseSynonyms,
			mode,
			table,
			key,
		);
	});
};

const tableToInterface = (m: RequiredModelSubset, table: AbstractSqlTable) => {
	const writableFields =
		table.definition != null
			? []
			: fieldsToInterfaceProps(m, table.fields, 'Write');
	const writeType =
		writableFields.length === 0
			? // If there's a table definition then we cannot write anything
				'Record<string, never>'
			: `{
		${writableFields.join('\n\t\t')}
	}`;
	return trimNL`
export interface ${modelNameToCamelCaseName(table.name)} {
	Read: {
		${[
			...fieldsToInterfaceProps(m, table.fields, 'Read'),
			...relationshipsToInterfaceProps(m, table, 'Read'),
		].join('\n\t\t')}
	};
	Write: ${writeType};
}
`;
};

type Mode = 'Read' | 'Write';

export const abstractSqlToTypescriptTypes = (
	m: RequiredModelSubset,
): string => {
	return trimNL`
// These types were generated by @balena/abstract-sql-to-typescript v${version}

import type { Types } from '@balena/abstract-sql-to-typescript';

${Object.keys(m.tables)
	.map((tableName) => {
		const t = m.tables[tableName];
		return tableToInterface(m, t);
	})
	.join('\n\n')}

export default interface $Model {
${Object.keys(m.tables)
	.map(
		(tableName) =>
			`	${sqlNameToODataName(tableName)}: ${modelNameToCamelCaseName(m.tables[tableName].name)};`,
	)
	.join('\n')}
${Object.keys(m.synonyms).length > 0 ? '	// Synonyms' : ''}
${Object.keys(m.synonyms)
	.map(
		(synonym) =>
			`	${sqlNameToODataName(synonym)}: ${modelNameToCamelCaseName(m.tables[m.synonyms[synonym]].name)};`,
	)
	.join('\n')}
}
`;
};
