
import { Runtime } from './runtime'
import { compileFile, compileModule } from './env'


const sdk = compileModule('./sdk')

console.log(JSON.stringify(sdk))
const file = './test.splash'

/* let compiled = compileFile(file,sdk)

console.log('executing...')
console.time('execution done')
let rt = new Runtime()
compiled.run(rt)
console.timeEnd('execution done') */