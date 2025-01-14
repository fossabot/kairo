import { Cleanable } from '../types';
import { doCleanup } from '../utils';
import { BloomFilter } from '../utils/bloom-filter';

type SideEffect = () => Cleanable;

class Scope<TExport = any> {
    public readonly exported: TExport;

    private sideEffects: SideEffect[] = [];
    private injections: Map<object, any> = new Map();
    private injections_bloom: BloomFilter;

    constructor(
        setup: () => TExport,
        public readonly parentScope?: Scope,
        public readonly rootScope?: Scope
    ) {
        const stored = Scope._currentScope;
        this.injections_bloom = new BloomFilter(
            8,
            4,
            parentScope?.injections_bloom.buckets
        );
        Scope._currentScope = this;
        this.exported = setup();
        Scope._currentScope = stored;
    }

    private static _currentScope: Scope | null = null;
    static get current() {
        if (Scope._currentScope) {
            return Scope._currentScope;
        }
        throw new TypeError('Not inside a scope.');
    }

    __internal_registerEffect(effect: SideEffect) {
        if (this !== Scope.current) {
            throw new TypeError('Invalid opearation');
        }
        this.sideEffects.push(effect);
    }

    __internal_registerProvider(arg0: any, arg1?: any): any {
        // TODO
        // if (this.sealed) {
        //     throw Error('Sealed');
        // }
        if (arg0 instanceof Token) {
            this.injections_bloom.add(arg0.name);
            this.injections.set(arg0, arg1);
            return arg1;
        } else if (
            typeof arg0 === 'function' &&
            assertType<Factory<any>>(arg0)
        ) {
            const exposed = arg1 != undefined ? arg0(...arg1) : arg0(); //TODO: PBP
            this.injections_bloom.add(arg0.name);
            this.injections.set(arg0, exposed);
            return exposed;
        } else if (arg0.provide && assertType<Provider<any>>(arg0)) {
            if ('useAlias' in arg0) {
                const aliased = inject(arg0.useAlias);

                this.injections_bloom.add(arg0.provide.name);
                this.injections.set(arg0.provide, aliased);

                return aliased;
            } else if ('useValue' in arg0) {
                this.injections_bloom.add(arg0.provide.name);
                this.injections.set(arg0.provide, arg0.useValue);

                return arg0.useValue;
            } else if ('useFactory' in arg0) {
                throw Error('not implemented');
            }
        }
    }

    __internal_inject(
        token: {
            name: string;
        },
        options?: any
    ): any {
        let scope: Scope | undefined = this;
        if (options?.skipSelf) {
            scope = scope.parentScope;
        }
        // get bloom hash
        if (scope?.injections_bloom.test(token.name) === false) {
            // if not exist in bloom filter, directly find in root
            scope = scope.rootScope;
        }
        while (scope) {
            const d = scope.injections.get(token);
            if (d === undefined) {
                scope = scope.parentScope ?? scope.rootScope;
            } else {
                return d;
            }
        }
        if (options?.optional) {
            return options.defaultValue ?? undefined;
        }
        throw Error(`Injection token '${token.name}' is not found.`);
    }

    private attached = false;
    attach() {
        if (this.attached) {
            throw TypeError('Scope has been attached');
        }
        this.attached = true;
        const cleanups = this.sideEffects.map((x) => x());
        return () => {
            this.attached = false;
            cleanups.forEach(doCleanup);
        };
    }
}

function effect(effectFn: SideEffect) {
    Scope.current.__internal_registerEffect(effectFn);
}

class Token<T> {
    constructor(public readonly name: string) {}

    static for<T>(name: string) {
        return new Token<T>(name);
    }

    toString() {
        return this.name;
    }
}

interface Factory<T> {
    name: string;
    (...args: any[]): T;
}

type Provider<T> = (
    | {
          useValue: T;
      }
    | {
          useFactory: (...args: []) => T;
          deps?: any[];
      }
    | {
          useAlias: Factory<T> | Token<T>;
      }
) & {
    provide: Factory<T> | Token<T>;
    multi?: boolean;
};

function assertType<T>(value: unknown): value is T {
    return true;
}

function provide<T>(providers: Provider<T>): T;
function provide<T>(factory: Factory<T>, args?: any[]): T;
function provide<T>(provide: Token<T>, value: T): T;
function provide<T>(arg0: any, arg1?: any): any {
    return Scope.current.__internal_registerProvider(arg0, arg1);
}

function inject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T;
function inject<T>(
    token: Token<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T;
function inject<T>(
    token: Token<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T;
function inject(
    token: {
        name: string;
    },
    options?: any
): any {
    return Scope.current.__internal_inject(token, options);
}

export { inject, provide, effect, Token, Scope, Factory, Provider };
