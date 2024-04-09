export type { Types } from '@balena/sbvr-types';

export type Expanded<T> = Extract<T, any[]>;
export type PickExpanded<T, K extends keyof T> = {
	[P in K]-?: Expanded<T[P]>;
};
export type Deferred<T> = Exclude<T, any[]>;
export type PickDeferred<T, K extends keyof T> = {
	[P in K]: Deferred<T[P]>;
};

import type {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlTable,
	InNode,
	Relationship,
	RelationshipInternalNode,
	RelationshipLeafNode,
} from '@balena/abstract-sql-compiler';
import {
	odataNameToSqlName,
	sqlNameToODataName,
} from '@balena/odata-to-abstract-sql';
import { replaceResultTransformer, TemplateTag } from 'common-tags';

type RequiredModelSubset = Pick<
	AbstractSqlModel,
	'tables' | 'relationships' | 'synonyms'
>;

const typeHelpers = {
	read: `import type { Types } from '@balena/abstract-sql-to-typescript';\n`,
	write: `import type { Types } from '@balena/abstract-sql-to-typescript';\n`,
};

const trimNL = new TemplateTag(
	replaceResultTransformer(/^[\r\n]*|[\r\n]*$/g, ''),
);

const modelNameToCamelCaseName = (s: string): string =>
	s
		.split(/[ -]/)
		.map((p) => p[0].toLocaleUpperCase() + p.slice(1))
		.join('');
const getReferencedInterface = (modelName: string, opts: Options) =>
	`${modelNameToCamelCaseName(modelName)}['${opts.mode}']`;

const sqlTypeToTypescriptType = (
	m: RequiredModelSubset,
	f: AbstractSqlField,
	opts: RequiredOptions,
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
				// TODO: Can `f.references` ever be null for these types?
				m.tables[f.references!.resourceName].name,
				opts,
			);
			const referencedFieldType = `${referencedInterface}['${f.references!.fieldName}']`;
			if (opts.mode === 'Write') {
				return referencedFieldType;
			}

			return `{ __id: ${referencedFieldType}${f.required ? '' : ' | null'} } | [${referencedInterface}${f.required ? '' : '?'}]`;
		}
		default:
			return `Types['${f.dataType}']['${opts.mode}']`;
	}
};

const fieldsToInterfaceProps = (
	m: RequiredModelSubset,
	fields: AbstractSqlField[],
	opts: RequiredOptions,
): string[] =>
	fields.map((f) => {
		const nullable = f.required ? '' : ' | null';
		return `${sqlNameToODataName(f.fieldName)}: ${sqlTypeToTypescriptType(
			m,
			f,
			opts,
		)}${nullable};`;
	});

const recurseRelationships = (
	m: RequiredModelSubset,
	relationships: Relationship,
	inverseSynonyms: Record<string, string>,
	opts: RequiredOptions,
	currentTable: AbstractSqlTable,
	parentKey: string,
): string[] =>
	Object.keys(relationships).flatMap((key) => {
		if (key === '$') {
			const [localField, referencedField] = (
				relationships as RelationshipLeafNode
			).$;
			if (currentTable.idField === localField && referencedField != null) {
				const referencedTable = m.tables[referencedField[0]];
				if (referencedTable != null) {
					const referencedInterface = getReferencedInterface(
						referencedTable.name,
						opts,
					);
					const propDefinitons = [`${parentKey}?: ${referencedInterface}[];`];
					const synonym = inverseSynonyms[odataNameToSqlName(parentKey)];
					if (synonym != null) {
						propDefinitons.push(
							`${sqlNameToODataName(synonym)}?: ${referencedInterface}[]`,
						);
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
			opts,
			currentTable,
			`${parentKey}__${key.replace(/ /g, '_')}`,
		);
	});

const relationshipsToInterfaceProps = (
	m: RequiredModelSubset,
	table: AbstractSqlTable,
	opts: RequiredOptions,
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
			opts,
			table,
			key.replace(/ /g, '_'),
		);
	});
};

const tableToInterface = (m: RequiredModelSubset, table: AbstractSqlTable) => {
	return trimNL`
export interface ${modelNameToCamelCaseName(table.name)} {
	Read: {
		${[
			...fieldsToInterfaceProps(m, table.fields, { mode: 'Read' }),
			...relationshipsToInterfaceProps(m, table, { mode: 'Read' }),
		].join('\n\t\t')}
	}
	Write: {
		${[...fieldsToInterfaceProps(m, table.fields, { mode: 'Write' })].join(
			'\n\t\t',
		)}
	}
}
`;
};

interface Options {
	mode?: 'Read' | 'Write';
}
type RequiredOptions = Required<Options>;

export const abstractSqlToTypescriptTypes = (
	m: RequiredModelSubset,
): string => {
	return trimNL`
${typeHelpers.read}
${Object.keys(m.tables)
	.map((tableName) => {
		const t = m.tables[tableName];
		return tableToInterface(m, t);
	})
	.join('\n\n')}
`;
};
