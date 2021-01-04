import {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlTable,
	InNode,
} from '@balena/abstract-sql-compiler';
import { sqlNameToODataName } from '@balena/odata-to-abstract-sql';
import { replaceResultTransformer, TemplateTag } from 'common-tags';

const typeHelpers = {
	read: `
export type DateString = string;
export type Expanded<T> = Extract<T, any[]>;
export type PickExpanded<T, K extends keyof T> = {
	[P in K]: Expanded<T[P]>;
};
export type Deferred<T> = Exclude<T, any[]>;
export type PickDeferred<T, K extends keyof T> = {
	[P in K]: Deferred<T[P]>;
};
`,
	write: '',
};

const trimNL = new TemplateTag(
	replaceResultTransformer(/^[\r\n]*|[\r\n]*$/g, ''),
);

const modelNameToCamelCaseName = (s: string): string =>
	s
		.split(/[ -]/)
		.map((p) => p[0].toLocaleUpperCase() + p.slice(1))
		.join('');

const getReferencedDataType = (
	m: AbstractSqlModel,
	{ references }: AbstractSqlField,
	opts: RequiredOptions,
): string => {
	if (references != null) {
		const referencedField = m.tables[references.resourceName].fields.find(
			(f) => f.fieldName === references.fieldName,
		);
		if (referencedField != null) {
			return sqlTypeToTypescriptType(m, referencedField, opts);
		}
	}
	return 'number';
};

const sqlTypeToTypescriptType = (
	m: AbstractSqlModel,
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
		case 'Boolean':
			return 'boolean';
		case 'Short Text':
		case 'Text':
		case 'Hashed':
			return 'string';
		case 'Date Time':
			return opts.mode === 'read' ? 'DateString' : 'Date';
		case 'Serial':
		case 'Integer':
		case 'Big Integer':
		case 'Real':
			return 'number';
		case 'ConceptType':
			// ConceptType should really act the same as a foreign key but as of pinejs 14 it is mistakenly treated as a local field
			return getReferencedDataType(m, f, opts);
		case 'ForeignKey':
			const referencedDataType = getReferencedDataType(m, f, opts);
			if (opts.mode === 'write') {
				return referencedDataType;
			}

			const referencedInterface = modelNameToCamelCaseName(
				m.tables[f.references!.resourceName].name,
			);
			const nullable = f.required ? '' : '?';
			return `{ __id: ${referencedDataType} } | [${referencedInterface}${nullable}]`;
		case 'File':
			return 'Buffer';
		case 'JSON':
			return '{}';
		default:
			throw new Error(`Unknown data type: '${f.dataType}'`);
	}
};

const fieldsToInterfaceProps = (
	m: AbstractSqlModel,
	fields: AbstractSqlField[],
	opts: RequiredOptions,
): string =>
	fields
		.map((f) => {
			const nullable = f.required ? '' : ' | null';
			return trimNL`
	${sqlNameToODataName(f.fieldName)}: ${sqlTypeToTypescriptType(
				m,
				f,
				opts,
			)}${nullable};
`;
		})
		.join('\n');

const tableToInterface = (
	m: AbstractSqlModel,
	table: AbstractSqlTable,
	opts: RequiredOptions,
) => trimNL`
export interface ${modelNameToCamelCaseName(table.name)} {
${fieldsToInterfaceProps(m, table.fields, opts)}
}
`;

export interface Options {
	mode?: 'read' | 'write';
}
type RequiredOptions = Required<Options>;

export const abstractSqlToTypescriptTypes = (
	m: AbstractSqlModel,
	opts: Options = {},
): string => {
	const mode = opts.mode ?? 'read';
	const requiredOptions: RequiredOptions = {
		...opts,
		mode,
	};
	return trimNL`
${typeHelpers[mode]}
${Object.keys(m.tables)
	.map((tableName) => {
		const t = m.tables[tableName];
		return tableToInterface(m, t, requiredOptions);
	})
	.join('\n\n')}
`;
};
