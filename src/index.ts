import {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlTable,
} from '@balena/abstract-sql-compiler';
import { sqlNameToODataName } from '@balena/odata-to-abstract-sql';
import { replaceResultTransformer, TemplateTag } from 'common-tags';

const trimNL = new TemplateTag(
	replaceResultTransformer(/^[\r\n]*|[\r\n]*$/g, ''),
);

const modelNameToTypescriptName = (s: string) =>
	s
		.split(/[ -]/)
		.map((p) => p[0].toLocaleUpperCase() + p.slice(1))
		.join('');

const sqlTypeToTypescriptType = (
	m: AbstractSqlModel,
	f: AbstractSqlField,
	serializable: boolean,
) => {
	switch (f.dataType) {
		case 'Boolean':
			return 'boolean';
		case 'Short Text':
		case 'Text':
		case 'Hashed':
			return 'string';
		case 'Date Time':
			return serializable ? 'string' : 'Date';
		case 'Serial':
		case 'Integer':
		case 'Big Integer':
		case 'Real':
			return 'number';
		// TODO: ForeignKey/ConceptType should really be that of the referenced id
		case 'ForeignKey':
		case 'ConceptType':
			const referencedInterface = modelNameToTypescriptName(
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
	opts?: Options,
) =>
	fields
		.map((f) => {
			const nullable = f.required ? '' : ' | null';
			return trimNL`
	${sqlNameToODataName(f.fieldName)}: ${sqlTypeToTypescriptType(
				m,
				f,
				!!opts?.serializable,
			)}${nullable};
`;
		})
		.join('\n');

const tableToInterface = (
	m: AbstractSqlModel,
	table: AbstractSqlTable,
	opts?: Options,
) => trimNL`
export interface ${modelNameToTypescriptName(table.name)} {
${fieldsToInterfaceProps(m, table.fields, opts)}
}
`;

interface Options {
	serializable?: boolean;
}

export const abstractSqlToTypescriptTypes = (
	m: AbstractSqlModel,
	opts?: Options,
) =>
	Object.keys(m.tables)
		.map((tableName) => {
			const t = m.tables[tableName];
			return tableToInterface(m, t, opts);
		})
		.join('\n\n') + '\n';
