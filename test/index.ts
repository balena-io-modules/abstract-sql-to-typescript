import { AbstractSqlModel } from '@balena/abstract-sql-compiler';
import { expect } from 'chai';
import { source } from 'common-tags';
import { abstractSqlToTypescriptTypes, Options } from '../src';

const test = (
	msg: string,
	model: Partial<AbstractSqlModel>,
	expectation: string,
	mode?: Options['mode'],
) => {
	it(`should generate ${msg}`, () => {
		// Set defaults for required props
		const t: AbstractSqlModel = {
			relationships: {},
			synonyms: {},
			tables: {},
			rules: [],
			...model,
		};

		expect(abstractSqlToTypescriptTypes(t, { mode })).to.equal(source`
			export type DateString = string;

			${expectation}
		`);
	});
};

test('no types for an empty model', {}, '');

const testTable: Partial<AbstractSqlModel> = {
	tables: {
		test: {
			fields: [
				{
					dataType: 'Date Time',
					fieldName: 'created at',
					required: true,
					defaultValue: 'CURRENT_TIMESTAMP',
				},
				{
					dataType: 'Date Time',
					fieldName: 'modified at',
					required: true,
					defaultValue: 'CURRENT_TIMESTAMP',
				},
				{
					dataType: 'Serial',
					fieldName: 'id',
					required: true,
					index: 'PRIMARY KEY',
				},
				{
					dataType: 'ConceptType',
					fieldName: 'parent',
					required: true,
					references: {
						resourceName: 'parent',
						fieldName: 'id',
					},
				},
				{
					dataType: 'ForeignKey',
					fieldName: 'referenced',
					required: true,
					references: {
						resourceName: 'referenced',
						fieldName: 'id',
					},
				},
			],
			primitive: false,
			name: 'test',
			indexes: [],
			idField: 'id',
			resourceName: 'test',
			triggers: [
				{
					when: 'BEFORE',
					operation: 'UPDATE',
					level: 'ROW',
					fnName: 'trigger_update_modified_at',
				},
			],
		},
		referenced: {
			fields: [
				{
					dataType: 'Serial',
					fieldName: 'id',
					required: true,
					index: 'PRIMARY KEY',
				},
			],
			primitive: false,
			name: 'referenced',
			indexes: [],
			idField: 'id',
			resourceName: 'referenced',
			triggers: [
				{
					when: 'BEFORE',
					operation: 'UPDATE',
					level: 'ROW',
					fnName: 'trigger_update_modified_at',
				},
			],
		},
	},
};

test(
	'correct read types for a test table',
	testTable,
	source`
		export interface Test {
			created_at: DateString;
			modified_at: DateString;
			id: number;
			parent: number;
			referenced: { __id: number } | [Referenced];
		}

		export interface Referenced {
			id: number;
		}
	`,
);

test(
	'correct write types for a test table',
	testTable,
	source`
		export interface Test {
			created_at: Date;
			modified_at: Date;
			id: number;
			parent: number;
			referenced: number;
		}

		export interface Referenced {
			id: number;
		}
	`,
	'write',
);
