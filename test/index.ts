import type { AbstractSqlModel } from '@balena/abstract-sql-compiler';
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
		const result = abstractSqlToTypescriptTypes(t, { mode });

		if (mode == null || mode === 'read') {
			expect(result).to.equal(source`
			export type DateString = string;
			export type Expanded<T> = Extract<T, any[]>;
			export type PickExpanded<T, K extends keyof T> = {
				[P in K]: Expanded<T[P]>;
			};
			export type Deferred<T> = Exclude<T, any[]>;
			export type PickDeferred<T, K extends keyof T> = {
				[P in K]: Deferred<T[P]>;
			};

			${expectation}
		`);
		} else {
			expect(result).to.equal(expectation);
		}
	});
};

test('no types for an empty model', {}, '');

const testTable: Partial<AbstractSqlModel> = {
	tables: {
		parent: {
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
			],
			primitive: false,
			name: 'parent',
			indexes: [],
			idField: 'id',
			resourceName: 'parent',
			triggers: [
				{
					when: 'BEFORE',
					operation: 'UPDATE',
					level: 'ROW',
					fnName: 'trigger_update_modified_at',
				},
			],
		},
		other: {
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
			],
			primitive: false,
			name: 'other',
			indexes: [],
			idField: 'id',
			resourceName: 'other',
			triggers: [
				{
					when: 'BEFORE',
					operation: 'UPDATE',
					level: 'ROW',
					fnName: 'trigger_update_modified_at',
				},
			],
		},
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
					fieldName: 'references-other',
					required: true,
					references: {
						resourceName: 'other',
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
	},
};

test(
	'correct read types for a test table',
	testTable,
	source`
		export interface Parent {
			created_at: DateString;
			modified_at: DateString;
			id: number;
		}

		export interface Other {
			created_at: DateString;
			modified_at: DateString;
			id: number;
		}

		export interface Test {
			created_at: DateString;
			modified_at: DateString;
			id: number;
			parent: number;
			references__other: { __id: number } | [Other];
		}
	`,
);

test(
	'correct write types for a test table',
	testTable,
	source`
		export interface Parent {
			created_at: Date;
			modified_at: Date;
			id: number;
		}

		export interface Other {
			created_at: Date;
			modified_at: Date;
			id: number;
		}

		export interface Test {
			created_at: Date;
			modified_at: Date;
			id: number;
			parent: number;
			references__other: number;
		}
	`,
	'write',
);
