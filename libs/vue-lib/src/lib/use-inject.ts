import {
    Behavior,
    Scope,
    ExtractBehaviorProperty,
    Factory,
    inject,
    Token,
    isBehavior,
    effect,
} from 'kairo';
import {
    inject as vueInject,
    ref,
    reactive,
    onUnmounted,
    Ref,
    onMounted,
    onActivated,
    onDeactivated,
} from 'vue';
import { SCOPE } from './context';

export function useInject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: Token<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: Token<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject(token: any, options: any): any {
    let expose = {};
    const scope = new Scope(() => {
        const resolve = inject(token, options);
        if (typeof resolve !== 'object' || resolve === null) {
            return resolve;
        }
        if (isBehavior(resolve)) {
            const tRef = ref(resolve.value);
            effect(() =>
                resolve.watch((updated) => {
                    tRef.value = updated;
                })
            );
            return tRef;
        }
        for (const [key, value] of Object.entries(resolve)) {
            if (typeof value === 'function') {
                expose[key] = value;
            } else if (isBehavior(value)) {
                const tRef = ref(value.value);
                effect(() =>
                    value.watch((updated) => {
                        tRef.value = updated;
                    })
                );
                expose[key] = tRef;
            } else {
                expose[key] = value;
            }
        }
    }, vueInject(SCOPE));

    let detachHandler: Function | null = null;

    onMounted(() => {
        detachHandler = scope.attach();
    });

    onUnmounted(() => {
        detachHandler!();
        detachHandler = null;
    });

    let deactivating = false;

    onActivated(() => {
        if (deactivating) {
            detachHandler = scope.attach();
            deactivating = false;
        }
    });

    onDeactivated(() => {
        detachHandler!();
        detachHandler = null;
        deactivating = true;
    });

    return reactive(expose);
}
