之前一直都是在懵懵懂懂的情况下使用 Promise，最近在决定重新学习一下 Promise，学着的时候突然来了兴趣，想去用原生 js 去实现它，于是在学习完后专门去找了个视频来学习手写 Promise。慢慢去弄的话还是不难的。

## Promise 介绍

Promise 主要用于处理 **异步编程**，减轻了 ES5 中回调函数带来的一些编写代码上的烦恼。Promise 对象有三种状态：`pending`*（待定中，可能会转为其它两种状态）*、`fulfilled`*（已成功，一旦处于这个状态，就不会再过渡到其他状态）*、`rejected`*（已失败，一旦处于这个状态，就不会再过渡到其他状态）*。

## 实现 Promise

在实现 Promise 之前要清楚的是 JavaScript 中的 Promise 遵循了 [**Promises/A+**](https://promisesaplus.com/) 规范。所以我们在编写 Promise 时也应当遵循这个规范。接着让我们来一步一步实现一个 MyPromise 吧(#^.^#)

### Promise 类的定义

Promise 一共有三个状态：`pending`、`fulfilled`、`rejected`。初始为 `pending` 状态。
``` javascript
const PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected';

class MyPromise {
  #status = PENDING;
}
```

### Promise 构造函数的定义

1. Promise 对象会传入一个 `executor` 函数。
2. `executor` 函数有两个参数且均为函数，分别是：`resolve`, `reject`。
3. 这两个函数均可以接受一个参数 *（`resolve` 形参为 `value`，`reject` 形参为 `reason`）*，并将其储存起来 *（这里我选择了用一个私人属性 `#value` 来存储，可以分开来用两个私人属性存储）*。
4. `resolve` 用于修改 Promise 状态从 `pending` 到 `fulfilled`。
5. `reject` 用于修改 Promise 状态从 `pending` 到 `rejected`。
6. 当 `executor` 函数抛出错误时会执行 `reject` 函数，并且将 `e` 作为 `reject` 的参数。
``` javascript
class MyPromise {
  #status = PENDING;
  #value = undefined;

  constructor(executor) {
    const resolve = (value) => {
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#status = FULFILLED;
        this.#value = value;
      }
    };

    const reject = (reason) => {
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#status = REJECTED;
        this.#value = reason;
      }
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }
}
```

### Promise 类实例上的方法定义

#### Promise.prototype.then()

##### 第一版

1. 该方法返回一个 Promise*（一般为 `fulfilled` 状态，后面会有特殊情况）*。
2. 接受两个 **可选** 参数，分别是 `onFulfilled` 和 `onRejected`。
3. 如果 `onFulfilled` 或 `onRejected` 为一个函数，则均接收一个参数，参数均为 `this.#value`。
4. `onFulfilled` 和 `onRejected` 的返回值就是返回的 Promise 的 `this.#value`。
5. `onFulfilled` 在状态为 `fulfilled` 时才会执行。
6. `onRejected` 在状态为 `rejected` 时才会执行。
``` javascript
  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      if (this.#status === FULFILLED) {
        let x = onFulfilled(this.#value);
        resolve(x);
      } else if (this.#status === REJECTED) {
        let x = onRejected(this.#value);
        resolve(x);
      }
    });
  }
```

##### 第二版

1. 如果 `onFulfilled` 或 `onRejected` 不是一个函数怎么办？接着我们来看一下 [**Promises/A+**](https://promisesaplus.com/) 的文档是如何解决的。
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e148d4d233054a84ae74404e3b98ef6f~tplv-k3u1fbpfcp-zoom-1.image)
大致的意思就是如果不是一个函数则就忽略它。
那么如何忽略呢？Promise 的 **值** 或 **状态** 需要接着传下去吗？我们不妨做个实验。
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9dbeb7a82faf489d86159d24779e7248~tplv-k3u1fbpfcp-zoom-1.image)
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/264be9cd5be94a10b93b69d5fb0253e1~tplv-k3u1fbpfcp-zoom-1.image)
可以发现 Promise 的 **值** 和 **状态** 都原封不动的传了下去。
2. 如果 Promise 的状态为 `pending`，过了一会异步代码执行完毕后转为了另外两个状态该怎么呢？此时我们就可以定义一个 `#callbacks` 队列，将 `onFulfilled` 和 `onRejected` 加入到之中，去等待上一个 `resolve` 或 `reject` 的执行。在状态改变完成后弹出相应的执行方法并执行。
3. 在执行 `onFulfilled` 或 `onRejected` 函数的过程中出错了，我们将会执行 `reject` 函数把错误交给下一个 `then` 方法来解决，并且参数为抛出错误的原因，所以此时我们可以使用 `try { } catch (e) { }` 来捕获异常。
``` javascript
class MyPromise {
  #status = PENDING;
  #value = undefined;
  #callbacks = [];
  
  constructor(executor) {
    const resolve = (value) => {
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#status = FULFILLED;
        this.#value = value;
        this.#callbacks.map(callback => {
          callback.onFulfilled(value);
        });
      }
    };

    const reject = (reason) => {
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#status = REJECTED;
        this.#value = reason;
        this.#callbacks.map(callback => {
          callback.onRejected(reason);
        });
      }
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }
  
  then(onFulfilled, onRejected) {
    if (typeof onFulfilled !== 'function') {
      onFulfilled = value => value;
    }
    if (typeof onRejected !== 'function') {
      onRejected = reason => { throw reason; };
    }

    new MyPromise((resolve, reject) => {
      if (this.#status === FULFILLED) {
        try {
          let x = onFulfilled(this.#value);
          resolve(x);
        } catch (e) {
          reject(e);
        }
      } else if (this.#status === REJECTED) {
        try {
          let x = onRejected(this.#value);
          resolve(x);
        } catch (e) {
          reject(e);
        }
      } else if (this.#status === PENDING) {
        this.#callbacks.push({
          onFulfilled: value => {
            try {
              let x = onFulfilled(value);
              resolve(x);
            } catch (e) {
              reject(e);
            }
          },
          onRejected: reason => {
            try {
              let x = onRejected(reason);
              resolve(x);
            } catch (e) {
              reject(e);
            }
          },
        });
      }
    });
  }
}
```

##### 第三版

1. 从始至终代码的运行都是同步的，没有一丝的异步，在使用的过程中会阻塞到后面的同步代码，如图：
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e360cffb234e4f8283d55c50935881cc~tplv-k3u1fbpfcp-zoom-1.image)
[**Promises/A+**](https://promisesaplus.com/) 文档里也有提到解决方案，如图:
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/993716cd3362459bb0ada86eff689491~tplv-k3u1fbpfcp-zoom-1.image)
ES6 中的 Promise 是创建了 **微任务**，但是这里我就使用了自己比较熟悉的 `setTimeout` 将其放入 **宏任务** 之中。
形如这样：
``` javascript
setTimeout(() => {
  // 需要异步执行的代码
});
```
2. 到这里这个方法的代码已经足够健壮了，但是在阅读 [**Promises/A+**](https://promisesaplus.com/) 文档，还是发现了一个问题，那就是当 `onFulfilled` 或 `onRejected` 返回的 `x` 仍然是个 Promise 时，是会把这个 Promise 存储到 `this.#value` 中，还是会将这个 Promise 的值及状态传递给上一个 Promise 呢？文档中也给出了明确的要求，如图：
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e5e615da58745cf8018c48cbd949826~tplv-k3u1fbpfcp-zoom-1.image)
规范中要求我们使用一个 `[[Resolve]](Promise2, x)` 方法来处理这种情况。
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b1e2a54dd5dd4260a804420c70aaaa2f~tplv-k3u1fbpfcp-zoom-1.image)
将其翻译过来大致意思就是：
  	1. 如果 Promise 和 `x` 引用 **同一** 对象，Promise 则抛出 `TypeError` 的错误。
	2. 如果 `x` 是一个 Promise，则返回的 Promise 采用 `x` 的值及状态。
	3. 如果 `x` 是对象或函数，则定义一个变量 `then` 等于 `x.then`，判断 `then` 是不是一个方法。
    	1. 如果不是，则按照普通值来处理；
        2. 如果是，则将 `then` 的 `this` 指向绑定到 `x` 上并执行它。
        	1. `then` 方法的第一个参数 `resolvePromise` 函数的形参为 `y`，并且在其中执行 `[[Resolve]](promise, y)`*（因为可能 `y` 也是一个对象或者函数，所有此时要递归的使用这个函数）*；
            2. 第二个参数 `rejectPromise` 函数的形参为 `r`，并且在其中执行执行 `reject(r)`；
            3. 如果同时调用 `resolvePromise` 和 `rejectPromise`，或者对同一参数进行了多次调用，则第一个调用优先，而所有其他调用均被忽略 *（可以定义一个变量 `called` 来判断是否被调用过）*；
            4. 如果调用 `then` 方法的时候出现异常 `e`。如果 `resolvePromise` 或	`rejectPromise` 已经被调用，则忽略它。否则，执行 `reject(e)`。
``` javascript
  #promiseResolve = function (myPromise2, x, resolve, reject) {
    if (myPromise2 === x) {
      reject(new TypeError('Chaining cycle detected for myPromise #<MyPromise>'));
    }

    let called = false; // 这里不太懂为啥要加这个，不加好像也没事，感觉应该是 Promises/A+ 规范的要求
    if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
      try {
        let then = x.then;
        if (typeof then === 'function') { // 认定其为 Promise
          then.call(x, y => {
            if (called) return;
            called = true;
            this.#promiseResolve(myPromise2, y, resolve, reject); // 有可能 y 还是个 Promise
          }, r => {
            if (called) return;
            called = true;
            reject(r);
          });
        } else {
          resolve(x);
        }
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
    } else {
      resolve(x);
    }
  }
  
  then(onFulfilled, onRejected) {
    if (typeof onFulfilled !== 'function') {
      onFulfilled = value => value;
    }
    if (typeof onRejected !== 'function') {
      onRejected = reason => { throw reason; };
    }

    let myPromise2 = new MyPromise((resolve, reject) => {
      if (this.#status === FULFILLED) {
        setTimeout(() => {
          try {
            let x = onFulfilled(this.#value);
            this.#promiseResolve(myPromise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      } else if (this.#status === REJECTED) {
        setTimeout(() => {
          try {
            let x = onRejected(this.#value);
            this.#promiseResolve(myPromise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      } else if (this.#status === PENDING) {
        this.#callbacks.push({
          onFulfilled: value => {
            try {
              let x = onFulfilled(value);
              this.#promiseResolve(myPromise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          },
          onRejected: reason => {
            try {
              let x = onRejected(reason);
              this.#promiseResolve(myPromise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          },
        });
      }
    });

    return myPromise2;
  }
```
到这里 `Promise.prototype.then()` 方法也终于码完了，(#^.^#)。  
不过此时在回想一下如果在定义 Promise 的时，在执行 `resolve` 及 `reject` 方法时传入的参数也为 Promise 是不是也要和之前的情况一样处理呢？不妨来做个试验。
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73e3650be246464cbfeb75eb93d19934~tplv-k3u1fbpfcp-zoom-1.image)
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1597a073294f446c83eac1a7bb7575a5~tplv-k3u1fbpfcp-zoom-1.image)
可以发现在执行 `resolve` 时会根据 Promise 参数的状态和值来改变外自身的状态和值，而执行 `reject` 的时候就仅仅只会把 Promise 参数当做值存储起来。此时我们代码又可以变的更加健壮了，嘿嘿😁！
``` javascript
    const resolve = (value) => {
      if (((typeof value === 'object' && value !== null) || typeof value === 'function')) {
        if (typeof value.then === 'function') {
          this.#promiseResolve(this, value, resolve, reject);
        }
      }
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#value = value;
        this.#status = FULFILLED;
        setTimeout(() => {
          this.#callbacks.map(callback => {
            callback.onFulfilled(value);
          });
        });
      }
    };
```

#### Promise.prototype.catch()

这个方法就很简单了，这个方法仅仅是来捕获上一个 Promise 错误的，并且也会返回一个 Promise 。可以使得链式的 Promise 在 `.then()` 方法中不用写重复的 `onRejected` 方法，可以一起到后面的 `.catch()` 来处理。相当于 `then(null, reason)` 或 `then(undefined, reason)`。
``` javascript
  catch(reason) {
    return this.then(null, reason);
  }
```

#### Promise.prototype.finally()

该方法 由 `ES2018` 引入，用于指定不管 Promise 对象最后状态如何，都会执行的操作。相当于 `then(value => value, reason => reason)`。
``` javascript
  finally(onFinally) {
    return this.then(value => {
      onFinally();
      return value;
    }, reason => {
      onFinally();
      throw reason;
    });
  }
```

### Promise 类静态方法的定义

#### Promise.resolve()

此方法可以理解为 `new Promise(resolve => { resolve(); });` 的简写。事实上也的确如此，所以实现这个方法的源码的时候也需要主要到传入参数的是否是一个对象或者方法。
``` javascript
  static resolve(value) {
    return new MyPromise((resolve, reject) => {
      if (typeof value.then === 'function') {
        value.then(resolve, reject);
      } else {
        resolve(value);
      }
    });
  }
```

#### Promise.reject()

和上一个方法类似，也可以理解为 `new Promise((resolve, reject) => { reject(); });` 的简写。
``` javascript
  static reject(reason) {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }
```

#### Promise.all()

1. 该方法将传入一个 Promise 数组，返回一个 Promise。
2. 等待全部的 Promise 都是 `fulfilled` 状态才会将返回的 Promise 转为 `fulfilled` 状态，并且 `#value` 值是由所有的 Promise 的值组成的数组。
3. 只要有一个是 `rejected` 状态 ，就会将返回的 Promise 转为 `rejected` 状态。
4. 如果数组中有不是 Promise 的则需要和 `resolve` 方法一样的进行处理。
``` javascript
  static all(myPromises) {
    return new MyPromise((resolve, reject) => {
      const values = [];
      myPromises.forEach(myPromise => {
        typeof myPromise.then !== 'function' && (myPromise = MyPromise.resolve(myPromise));
        myPromise.then(value => {
          values.push(value);
          values.length === myPromises.length && resolve(values); // 只有当 values 数组长度等于 MyPromises 的长度时才能 resolve，不能放在循环的外面，因为这里面是异步的代码。
        }, reason => {
          reject(reason);
        });
      });
    });
  }
```

#### Promise.race()

1. 该方法将传入一个 Promise 数组，返回一个 Promise。
2. 哪一个 Promise 先改变状态，则返回的 Promise 状态和值就跟着它一起改变。
3. 如果数组中有不是 Promise 的则需要和 `resolve` 方法一样的进行处理。
``` javascript
  static race(myPromises) {
    return new MyPromise((resolve, reject) => {
      myPromises.forEach(myPromise => {
        typeof myPromise.then !== 'function' && (myPromise = MyPromise.resolve(myPromise));
        myPromise.then(value => {
          resolve(value);
        }, reason => {
          reject(reason);
        })
      });
    });
  }
```

#### Promise.allSettled()

1. 该方法将传入一个 Promise 数组，返回一个 Promise。
2. `ES2020` 引入，只有等到所有这些参数实例都返回结果 *（不管是 `fulfilled` 状态还是 `rejected` 状态）*，包装实例才会结束。
3. 一旦结束返回的 Promise 总是 `fulfilled` 状态。
4. 返回的值会是一个对象数组，每一个对象则记录了每个 Promise 的状态及值。
5. 如果数组中有不是 Promise 的则需要和 `resolve` 方法一样的进行处理。
``` javascript
  static allSettled(myPromises) {
    return new MyPromise(resolve => {
      const values = [];
      myPromises.forEach(myPromise => {
        typeof myPromise.then !== 'function' && (myPromise = MyPromise.resolve(myPromise));
        myPromise.then(value => {
          values.push({ status: FULFILLED, value });
          values.length === myPromises.length && resolve(values);
        }, reason => {
          values.push({ status: REJECTED, reason });
          values.length === myPromises.length && resolve(values);
        })
      });
    });
  }
```

#### Promise.any()

1. 该方法将传入一个 Promise 数组，返回一个 Promise。
2. 目前是一个第三阶段的 **提案**。
3. 等待全部的 Promise 都是 `rejected` 状态才会将返回的 Promise 转为 `rejected` 状态，并且 `#value` 值是一个 `AggregateError` 错误 *（一个实验中的功能，传入两个参数，第一个参数是许多错误的一个数组集合，第二个参数是错误提示）*。将会把所有的错误信息都放如到 `AggregateError` 里面。
4. 只要有一个是 `fulfilled` 状态 ，就会将返回的 Promise 转为 `fulfilled` 状态。
5. 如果数组中有不是 Promise 的则需要和 `resolve` 方法一样的进行处理。
``` javascript
  static any(myPromises) {
    return new MyPromise((resolve, reject) => {
      const values = [];
      myPromises.forEach(myPromise => {
        typeof myPromise.then !== 'function' && (myPromise = MyPromise.resolve(myPromise));
        myPromise.then(value => {
          resolve(value);
        }, reason => {
          values.push(reason);
          values.length === myPromises.length
            && reject(new AggregateError(values, 'All promises were rejected')); // AggregateError 一个实验中的功能
        })
      });
    });
  }
```

## 所有的源码

由于代码还是挺长的，就不贴出来了，需要的请移步我的 [GitHub]()，或者私信我。

## 最后的话及测试

到这里代码也终于码完啦~，接着顺便拿 Promises/A+ 里的测试工具测试了一下，结果发现有 22 个用例没有通过
![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5075e1d7972f42579112a1428001f598~tplv-k3u1fbpfcp-zoom-1.image)
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b3681334a9345a58a21740dd98330f1~tplv-k3u1fbpfcp-zoom-1.image)
其他的错误好像和上面这个差不多就不全贴了。  
想了好久好久都百思不得其解，结果发现在编写构造函数里的 `resolve` 方法时把考虑参数为函数或对象时的代码去掉，就可以完美通过。
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a193989146e3484aa9f984fd80009b0d~tplv-k3u1fbpfcp-zoom-1.image)
虽然发现了这个 `bug` 但还是想不通。无论如何改代码都还是会有问题，搜了搜其他人的实现好像也没提到这个 `bug`，就也没纠结了。如果看到这里的读者有知道啥情况的可以评论区聊聊呀，嘻嘻(#^.^#)，最后谢谢大家的浏览啦😝，完结！！！

## 参考书籍及规范

1. 阮一峰的 [《ECMAScript 6 入门教程》](https://es6.ruanyifeng.com/)
2. [Promises/A+](https://promisesaplus.com/) 规范