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

const actorTable: Partial<AbstractSqlModel> = {
	tables: {
		actor: {
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
			name: 'actor',
			indexes: [],
			idField: 'id',
			resourceName: 'actor',
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
	'correct read types for an actor table',
	actorTable,
	source`
		export interface Actor {
			created_at: Date;
			modified_at: Date;
			id: number;
		}
	`,
);

test(
	'correct write types for an actor table',
	actorTable,
	source`
		export interface Actor {
			created_at: Date;
			modified_at: Date;
			id: number;
		}
	`,
	'write',
);

test(
	'correct types for two tables',
	{
		tables: {
			actor: {
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
				name: 'actor',
				indexes: [],
				idField: 'id',
				resourceName: 'actor',
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
				resourceName: 'actor',
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
	},
	source`
		export interface Actor {
			created_at: Date;
			modified_at: Date;
			id: number;
		}

		export interface Other {
			created_at: Date;
			modified_at: Date;
			id: number;
		}
	`,
);
