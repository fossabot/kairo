import { Suite } from 'benchmark';
import {
    Bridge,
    KairoBridge,
    KairoInternal,
    KairoInternalStatic,
    KairoStaticBridge,
    MobxBridge,
    SBridge,
    SolidBridge,
    VueReactiveBridge,
} from './common';

declare global {
    const __DEV__: boolean;
    const __TEST__: boolean;
}

(global as any).__DEV__ = false;
(global as any).__TEST__ = false;

const suite = new Suite('reactive');

function spinwait(time: number) {
    // return;
    const start = Date.now();
    const end = start + time;
    while (true) {
        if (Date.now() > end) {
            return;
        }
    }
}

function assert(v1: any, v2: any) {
    if (v1 != v2) {
        throw new Error('assert failed');
    }
}

function NormalTest(bridge: Bridge) {
    let end = false;
    bridge.root(() => {
        const a = bridge.cell(0);
        const b = bridge.cell(1);
        const c = bridge.computed(() => {
            let p = a.read();
            p = a.read() + b.read();
            p = a.read() + b.read();
            p = a.read() + b.read();
            p = a.read() + b.read();
            p = a.read() + b.read();
            p = a.read() + b.read();
            // console.log(p);
            return 9;
        });
        const d = bridge.computed(() => {
            let g = b.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            g = b.read() + c.read();
            // console.log(g);
            return 11;
        });

        bridge.watch(
            () => c.read(),
            (v) => {
                // console.log(v);
                // spinwait(1);
            }
        );

        bridge.watch(
            () => d.read(),
            (v) => {
                // console.log(v);
                // spinwait(1);
            }
        );

        a.write(100);
        b.write(1000);
        // assert(c.read(), 1100);
        // assert(d.read(), 1100 + 1000);
        for (let i = 0; i < 10; i++) {
            a.write(i);
            // assert(c.read(), i + 1000);
            // assert(d.read(), i + 2000);
            assert(c.read(), 9);
            assert(d.read(), 11);
        }
        end = true;
    });
    // console.log('endloop');
}

let results = [];

export function test() {
    // debugger;
    suite
        // .add('solid', () => {
        //     NormalTest(SolidBridge);
        // })
        // .add('mobx', () => {
        //     NormalTest(MobxBridge);
        // })
        .add('s', () => {
            NormalTest(SBridge);
        })
        .add('kairo static', () => {
            NormalTest(KairoStaticBridge);
        })
        .add('kairo "internal api"', () => {
            NormalTest(KairoInternal);
        })
        .add('kairo static "internal api"', () => {
            NormalTest(KairoInternalStatic);
        })
        // .add('kairo', () => {
        //     NormalTest(KairoBridge);
        // })
        // .add('vue', () => {
        //     NormalTest(VueReactiveBridge);
        // })
        .on('error', (e) => {
            console.log(e.target.error);
        })
        .on('cycle', (s) => {
            // console.log(String(s.target));
            results.push(String(s.target));
            // global.gc();
        })
        .run({
            async: true,
        })
        .on('complete', () => {
            results.forEach((s) => {
                console.log(s);
            });
        });
}

test();
