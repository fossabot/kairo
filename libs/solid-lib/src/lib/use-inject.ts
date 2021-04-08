import {
    action,
    Behavior,
    createScope,
    disposeScope,
    ExtractBehaviorProperty,
    Factory,
    inject,
    InjectToken,
    isBehavior,
    runIfScopeExist,
} from 'kairo';
import { onCleanup, useContext } from 'solid-js';
import { KairoContext } from './context';

export function useInject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T extends Behavior<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject(token: any, options: any): any {
    runIfScopeExist(() => {
        throw Error('Use `inject` instead of `useInject` if inside a scope.');
    });
    const context = useContext(KairoContext);
    let expose = {};
    const { scope } = createScope(() => {
        const resolve = inject(token, options);
        if (typeof resolve !== 'object' || resolve === null) {
            return resolve;
        }
        if (isBehavior(resolve)) {
            return () => resolve.value;
        }
        for (const [key, value] of Object.entries(resolve)) {
            if (typeof value === 'function') {
                expose[key] = action(value);
            } else if (isBehavior(value)) {
                Object.defineProperty(expose, key, {
                    get() {
                        return value.value;
                    },
                    enumerable: true,
                    configurable: true,
                });
            } else {
                expose[key] = value;
            }
        }
    }, context);
    onCleanup(() => {
        disposeScope(scope);
    });
    return expose;
}
