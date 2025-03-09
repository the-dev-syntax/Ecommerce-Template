import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type BrowsingHistory = {
  products: { id: string; category: string }[]
}
const initialState: BrowsingHistory = {
  products: [],
}

//* chained function, create() return a fn1 , presist() return a fn2, fn1(fn2()) , fn2 is an argument for fn1.
export const browsingHistoryStore = create<BrowsingHistory>()(
  persist(() => initialState, {
    name: 'browsingHistoryStore',
  })
)

export default function useBrowsingHistory() {
  const { products } = browsingHistoryStore()
  return {
    products,
    addItem: (product: { id: string; category: string }) => {
      const index = products.findIndex((p) => p.id === product.id) // Find duplicate if not return -1
      if (index !== -1) products.splice(index, 1) // Remove duplicate if it exists, splice(index, deleteCount)
      products.unshift(product) // Add id to the start

      if (products.length > 10) products.pop() // Remove excess items if length exceeds 10

      browsingHistoryStore.setState({
        products,
      })
    },

    clear: () => {
      browsingHistoryStore.setState({
        products: [],
      })
    },
  }
}
//^ explaining addItem method :
//  find Index of the product i want to add , if not -1, if yes cut it out of the array and add the same product to the start of the array, and if the array has 10 product cut the last one out.

/*
* why addItem: written like that ? and // why clear: written like that ?
 addItem: (product: { id: string; category: string }) => {...}
 clear: () => {...}
 ?  they are methods in an object when call it activate a function.
 return {
  products: products,
  addItem: function(product) { ... },
  clear: function() { ... }
};

*/
/* 
* findIndex
This uses the findIndex method of the products array.
  The findIndex method iterates over the array and returns the index of the first element that satisfies the provided testing function.
  If no element satisfies the testing function, it returns -1.
*/

//----------------------------------------

/*
* chained function =====> Simplified Example (Illustrative)
function addOne(x: number): (y: number) => number {
  return function(y: number): number {
    return x + y;
  }
}

const add5 = addOne(5); // Returns a function that adds 5 to its argument
const result = add5(3);   // result will be 8

console.log(result);
------------------------------------------------------

^ create<BrowsingHistory>() is a fn that Returns a fn that creates the state.
^ That Presist({...}) function is the argument of the create State to update the state
^ create() return a fn1 , presist() return a fn2, fn1(fn2()) 
*/
