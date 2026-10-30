import { source } from 'common-tags';
import { idField, table, test } from './helpers.ts';

test(
	'a single interface for tables that generate identical interfaces',
	{
		tables: {
			device: table('device', [idField]),
			// eg a versioned copy of a table added by pinejs translations
			device$v1: table('device', [idField]),
		},
	},
	source`
		export interface Device {
			Read: {
				id: Types['Serial']['Read'];
			};
			Write: {
				id: Types['Serial']['Write'];
			};
		}

		export default interface $Model {
			device: Device;
			device$v1: Device;


		}
	`,
);
