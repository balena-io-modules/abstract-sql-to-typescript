import type { Types } from '@balena/sbvr-types';
export type { Types } from '@balena/sbvr-types';

export type Expanded<T> = Extract<T, any[]>;
export type PickExpanded<T, K extends keyof T = keyof T> = {
	[P in K]-?: Expanded<T[P]>;
};
export type Deferred<T> = Exclude<T, any[]>;
export type PickDeferred<T, K extends keyof T = keyof T> = {
	[P in K]: Deferred<T[P]>;
};

type ReadTypes = Types[keyof Types]['Read'];
type WriteTypes = Types[keyof Types]['Write'];

export type Resource<T extends object = object> = {
	Read: {
		[key in keyof T]: ReadTypes | { __id: ReadTypes } | Array<Resource['Read']>;
	};
	Write: {
		[key in keyof T]: WriteTypes;
	};
};
