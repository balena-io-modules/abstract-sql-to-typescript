import type { Types } from '@balena/sbvr-types';
export type { Types } from '@balena/sbvr-types';

export type PickDeferredExpanded<
	T,
	U extends { Deferred?: Array<keyof T>; Expanded?: Array<keyof T> },
> = PickDeferred<T, Extract<U['Deferred'], Array<keyof T>>[number]> &
	PickExpanded<T, Extract<U['Expanded'], Array<keyof T>>[number]>;

export type Expanded<T> = Extract<T, Array<Resource['Read']>>;
export type PickExpanded<T, K extends keyof T = keyof T> = {
	[P in K]-?: Expanded<T[P]>;
};
export type Deferred<T> = Exclude<T, Array<Resource['Read']>>;
export type PickDeferred<T, K extends keyof T = keyof T> = {
	[P in K]: Deferred<T[P]>;
};

type ReadTypes = Types[keyof Types]['Read'];
type WriteTypes = Types[keyof Types]['Write'];

export type Resource<
	T extends object = {
		[index: string]: any;
	},
> = {
	Read: {
		[key in keyof T]:
			| ReadTypes
			| { __id: ReadTypes }
			| Array<Resource['Read']>
			| null;
	};
	Write: {
		[key in keyof T]: WriteTypes | null;
	};
};
