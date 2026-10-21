import type { AbstractSqlField } from '@balena/abstract-sql-compiler';
import { source } from 'common-tags';
import { idField, table, test } from './helpers.ts';

const fk = (
	fieldName: string,
	resourceName: string,
	{ referencedField = 'id', required = true } = {},
): AbstractSqlField => ({
	dataType: 'ForeignKey',
	fieldName,
	required,
	references: { resourceName, fieldName: referencedField },
});

test(
	'inlined write types for references to fields that are not writable',
	{
		tables: {
			'view parent': table('view parent', [idField], {
				definition: { abstractSql: ['Table', 'parent'] },
			}),
			'partial parent': table(
				'partial parent',
				[
					idField,
					{ dataType: 'Short Text', fieldName: 'name', required: true },
				],
				{
					modifyFields: [
						{ dataType: 'Short Text', fieldName: 'name', required: true },
					],
				},
			),
			'status parent': table('status parent', [
				{
					...idField,
					dataType: 'Short Text',
					checks: [['In', ['Field', 'id'], ['Text', 'a'], ['Text', 'b']]],
					computed: true,
				},
			]),
			child: table('child', [
				idField,
				fk('view parent', 'view parent'),
				fk('partial parent', 'partial parent', { required: false }),
				fk('status parent', 'status parent'),
			]),
		},
	},
	source`
		export interface ViewParent {
			Read: {
				id: Types['Serial']['Read'];
			};
			Write: Record<string, never>;
		}

		export interface PartialParent {
			Read: {
				id: Types['Serial']['Read'];
				name: Types['Short Text']['Read'];
			};
			Write: {
				name: Types['Short Text']['Write'];
			};
		}

		export interface StatusParent {
			Read: {
				id: 'a' | 'b';
			};
			Write: Record<string, never>;
		}

		export interface Child {
			Read: {
				id: Types['Serial']['Read'];
				view_parent: { __id: ViewParent['Read']['id'] } | [ViewParent['Read']];
				partial_parent: { __id: PartialParent['Read']['id'] } | [PartialParent['Read']] | [] | null;
				status_parent: { __id: StatusParent['Read']['id'] } | [StatusParent['Read']];
			};
			Write: {
				id: Types['Serial']['Write'];
				view_parent: Types['Serial']['Write'];
				partial_parent: Types['Serial']['Write'] | null;
				status_parent: 'a' | 'b';
			};
		}

		export default interface $Model {
			view_parent: ViewParent;
			partial_parent: PartialParent;
			status_parent: StatusParent;
			child: Child;


		}
	`,
);

test(
	'references to id fields that are not named `id`',
	{
		tables: {
			// eg from `Database ID Field: model name`
			migration: table(
				'migration',
				[
					{
						dataType: 'Short Text',
						fieldName: 'model name',
						required: true,
						index: 'PRIMARY KEY',
					},
				],
				{ idField: 'model name' },
			),
			'migration run': table('migration run', [
				idField,
				fk('is of-migration', 'migration', { referencedField: 'model name' }),
			]),
		},
	},
	source`
		export interface Migration {
			Read: {
				model_name: Types['Short Text']['Read'];
			};
			Write: {
				model_name: Types['Short Text']['Write'];
			};
		}

		export interface MigrationRun {
			Read: {
				id: Types['Serial']['Read'];
				is_of__migration: { __id: Migration['Read']['model_name'] } | [Migration['Read']];
			};
			Write: {
				id: Types['Serial']['Write'];
				is_of__migration: Migration['Write']['model_name'];
			};
		}

		export default interface $Model {
			migration: Migration;
			migration_run: MigrationRun;


		}
	`,
);

test(
	'no writable fields when all fields are computed',
	{
		tables: {
			summary: table('summary', [
				{ ...idField, computed: ['Field', 'id'] },
				{
					dataType: 'Integer',
					fieldName: 'total',
					required: true,
					computed: ['Integer', 1],
				},
			]),
		},
	},
	source`
		export interface Summary {
			Read: {
				id: Types['Serial']['Read'];
				total: Types['Integer']['Read'];
			};
			Write: Record<string, never>;
		}

		export default interface $Model {
			summary: Summary;


		}
	`,
);
