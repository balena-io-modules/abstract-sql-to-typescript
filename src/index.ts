import {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlTable,
	InNode,
} from '@balena/abstract-sql-compiler';
import { sqlNameToODataName } from '@balena/odata-to-abstract-sql';
import { replaceResultTransformer, TemplateTag } from 'common-tags';

const trimNL = new TemplateTag(
	replaceResultTransformer(/^[\r\n]*|[\r\n]*$/g, ''),
);

const modelNameToCamelCaseName = (s: string) =>
	s
		.split(/[ -]/)
		.map((p) => p[0].toLocaleUpperCase() + p.slice(1))
		.join('');

const sqlTypeToTypescriptType = (
	m: AbstractSqlModel,
	f: AbstractSqlField,
	opts: RequiredOptions,
) => {
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
		// TODO: ForeignKey/ConceptType should really be that of the referenced id
		case 'ForeignKey':
		case 'ConceptType':
			if (opts.mode === 'write') {
				return 'number';
			}

			const referencedInterface = modelNameToCamelCaseName(
				m.tables[f.references!.resourceName].name,
			);
			const nullable = f.required ? '' : '?';
			return `{ __id: number } | [${referencedInterface}${nullable}]`;
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
) =>
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
) => {
	const requiredOptions: RequiredOptions = {
		mode: 'read',
		...opts,
	};
	return trimNL`
export type DateString = string;
${Object.keys(m.tables)
	.map((tableName) => {
		const t = m.tables[tableName];
		return tableToInterface(m, t, requiredOptions);
	})
	.join('\n\n')}
`;
};
