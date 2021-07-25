import {BaseTokenizer} from './tokenizer'
import * as fs from 'fs'
import { Parser } from './parser'
import { Processor } from './processor'
import { Runtime } from './runtime'
import path from 'path'

const file = './test.splash'

const input = fs.readFileSync(file).toString('utf-8')

let tokenizer = new BaseTokenizer(input)

let parser = new Parser(file, tokenizer)

console.log('compiling...')
console.time('compilation done')
let root = parser.parseFile()
//console.log(JSON.stringify(root,undefined,2))
console.timeEnd('compilation done')

if (!parser.hasErrors) {
    console.log('processing...')
    console.time('processing done')
    let proc = new Processor(root,path.basename(file))
    proc.root.index(proc)

    proc.process()
    console.timeEnd('processing done')

    if (!proc.hasErrors) {
        console.log('generating...')
        console.time('generation done')
        let generated = proc.root.generate(proc)
        console.timeEnd('generation done')

        console.log('executing...')
        console.time('execution done')
        let rt = new Runtime(generated)
        rt.types.push(...proc.types)
        generated.run(rt)
        console.timeEnd('execution done')
    }
}