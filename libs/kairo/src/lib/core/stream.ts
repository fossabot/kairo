import { Cleanable, TeardownLogic } from '../types';
import { doCleanup } from '../utils';

interface SubscriptionNode {
    next: SubscriptionNode | null;
    prev: SubscriptionNode | null;
    handler: Function;
}

export class EventStream<T> {
    constructor(
        private onSubscribe: (next: (value: T) => void) => TeardownLogic
    ) {}

    *[Symbol.iterator]() {
        return (yield this) as T;
    }

    private currentSubscription: TeardownLogic | null = null;

    private head: SubscriptionNode | null = null;
    private tail: SubscriptionNode | null = null;

    private __internal_subscribe(handler: (value: T) => void) {
        const node: SubscriptionNode = {
            next: null,
            prev: this.tail,
            handler: handler,
        };
        if (!this.head) {
            this.head = node;
            this.tail = node;
            // activate
            this.currentSubscription = this.onSubscribe((s) => this.next(s));
        } else {
            this.tail!.next = node;
            this.tail = node;
        }
        const subscription = () => {
            if (node.prev) {
                //node is head
                node.prev.next = node.next;
            } else {
                this.head = node.next;
            }
            if (node.next) {
                //node is tail
                node.next.prev = node.prev;
            } else {
                this.tail = node.prev;
            }
            if (!this.head) {
                // deactivate
                this.currentSubscription!();
            }
        };
        return subscription;
    }

    private next(value: T) {
        let p = this.head;
        const handlers = [] as Function[];
        while (p !== null) {
            handlers.push(p.handler);
            p = p.next;
        }
        // linked list is mutable data structure thus a immutable snapshot of subscriptions is required.
        // then you can subscribe or unsubscirbe inside a handler.
        while (handlers.length) {
            handlers.pop()!(value);
        }
    }

    listen(handler: (value: T) => Cleanable): TeardownLogic {
        let lastDisposer: Cleanable = undefined;
        const unsubscribe = this.__internal_subscribe((value) => {
            doCleanup(lastDisposer);
            lastDisposer = handler(value);
        });
        return () => {
            doCleanup(lastDisposer);
            unsubscribe();
        };
    }

    transform<R>(transformFn: (value: T) => R) {
        return new EventStream<R>((next) => {
            return this.__internal_subscribe((v) => next(transformFn(v)));
        });
    }

    filter(filterFn: (value: T) => boolean) {
        return new EventStream<T>((next) => {
            return this.__internal_subscribe((v) => filterFn(v) ?? next(v));
        });
    }

    static create<T>(): [EventStream<T>, (payload: T) => void] {
        const stream = never<T>();
        return [stream, (payload: T) => stream.next(payload)];
    }
}

export function stream<T = any>() {
    return EventStream.create<T>();
}

export function never<T = never>() {
    return new EventStream<T>(() => {
        return () => {};
    });
}

type ExtractEventStream<T> = {
    [P in keyof T]: T[P] extends EventStream<infer C> ? C : unknown;
};

export function merged<A extends Array<EventStream<any>>>(
    array: A
): EventStream<ExtractEventStream<A>[number]> {
    return new EventStream((next) => {
        const listeners = array.map((stream) => stream.listen(next));
        return () => listeners.forEach((x) => x());
    });
}
