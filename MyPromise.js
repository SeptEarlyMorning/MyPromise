const PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected';

class MyPromise {
  /* 私有属性 */
  #status = PENDING;
  #value = undefined;
  #callbacks = [];

  /* 构造函数 */
  constructor(executor) {
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

    const reject = (reason) => {
      if (this.#status === PENDING) { // 只有当状态为 pending 时才会执行
        this.#status = REJECTED;
        this.#value = reason;
        setTimeout(() => {
          this.#callbacks.map(callback => {
            callback.onRejected(reason);
          });
        });
      }
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  /* 静态方法 */
  static resolve(value) {
    return new MyPromise((resolve, reject) => {
      if (typeof value.then === 'function') {
        value.then(resolve, reject);
      } else {
        resolve(value);
      }
    });
  }

  static reject(reason) {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }

  /* 全部的 Promise 都是 fulfilled 状态才会返回 fulfilled 状态的 Promise，
     值是由所有的 Promise 的值组成的数组。
     有一个是 rejected ，就会将返回的 Promise 的状态转为 rejected 状态 */
  static all(myPromises) {
    return new MyPromise((resolve, reject) => {
      const values = [];
      myPromises.forEach(myPromise => {
        typeof myPromise.then !== 'function' && (myPromise = MyPromise.resolve(myPromise));
        myPromise.then(value => {
          values.push(value);
          values.length === myPromises.length && resolve(values);
        }, reason => {
          reject(reason);
        });
      });
    });
  }

  /* 哪一个 Promise 先改变状态，则就将返回的 Promise 状态转为最先的状态 */
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

  /* ES2020 引入的，
     只有等到所有这些参数实例都返回结果（不管是 fulfilled 状态还是 rejected 状态），包装实例才会结束。
     并且一旦结束返回的 Promise 总是 fulfilled 状态 */
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

  /* 该方法还是个提案 */
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

  /* 私有方法 */
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

  /* 相当于 then(null, reason) 或 then(undefined, reason) */
  catch(reason) {
    return this.then(null, reason);
  }

  /* ES2018 引入的，
     用于指定不管 Promise 对象最后状态如何，都会执行的操作。
     相当于 then(value => value, reason => reason)。 */
  finally(onFinally) {
    return this.then(value => {
      onFinally();
      return value;
    }, reason => {
      onFinally();
      throw reason;
    });
  }
}