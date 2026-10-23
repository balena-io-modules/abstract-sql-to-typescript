import type {
	AbstractSqlField,
	AnyTypeNodes,
} from '@balena/abstract-sql-compiler';
import { idField, table, test } from './helpers.js';

const enumField = (
	fieldName: string,
	dataType: string,
	values: AnyTypeNodes[],
	required = true,
): AbstractSqlField => ({
	dataType,
	fieldName,
	required,
	checks: [['In', ['Field', fieldName], ...(values as [AnyTypeNodes])]],
});

test(
	'escaped literal types for the allowed values of fields',
	{
		tables: {
			thing: table('thing', [
				idField,
				enumField('label', 'Short Text', [
					['Text', "it's"],
					['Text', 'a\\"b'],
					['Text', 'c\\d'],
					['Text', 'e\nf'],
					['EmbeddedText', 'plain'],
				]),
				enumField(
					'level',
					'Integer',
					[
						['Integer', -1],
						['Integer', 2],
						['Real', 2.5],
					],
					false,
				),
				enumField('flag', 'Boolean', [['Boolean', true]]),
				// A value we cannot represent as a literal falls back to the field's type
				enumField('other', 'Short Text', [
					['Text', 'a'],
					['Bind', 0],
				]),
			]),
		},
	},
	String.raw`export interface Thing {
	Read: {
		id: Types['Serial']['Read'];
		label: 'it\'s' | 'a\\"b' | 'c\\d' | 'e\nf' | 'plain';
		level: -1 | 2 | 2.5 | null;
		flag: true;
		other: Types['Short Text']['Read'];
	};
	Write: {
		id: Types['Serial']['Write'];
		label: 'it\'s' | 'a\\"b' | 'c\\d' | 'e\nf' | 'plain';
		level: -1 | 2 | 2.5 | null;
		flag: true;
		other: Types['Short Text']['Write'];
	};
}

export default interface $Model {
	thing: Thing;


}`,
);
