export type { Types } from '@balena/sbvr-types';

export type Expanded<T> = Extract<T, any[]>;
export type PickExpanded<T, K extends keyof T = keyof T> = {
	[P in K]-?: Expanded<T[P]>;
};
export type Deferred<T> = Exclude<T, any[]>;
export type PickDeferred<T, K extends keyof T = keyof T> = {
	[P in K]: Deferred<T[P]>;
};
