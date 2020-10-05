import { AbstractSqlModel } from '@balena/abstract-sql-compiler';
import { expect } from 'chai';
import { stripIndent } from 'common-tags';
import { abstractSqlToTypescriptTypes } from '../src';

const test = (s: string, m: Partial<AbstractSqlModel>, e: string) => {
	it(`should generate ${s}`, () => {
		// Set defaults for required props
		const t: AbstractSqlModel = {
			relationships: {},
			synonyms: {},
			tables: {},
			rules: [],
			...m,
		};

		expect(abstractSqlToTypescriptTypes(t)).to.equal(e);
	});
};

test('no types for an empty model', {}, '');
test('correct types for an actor table',
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
		},
	},
	stripIndent`
		interface Actor {
			created_at?: Date;
			modified_at?: Date;
			id?: number;
		}
	`,
);
