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

console.time('compilation')

let root = parser.parseFile()
//console.log(JSON.stringify(root,undefined,2))
console.timeEnd('compilation')

console.time('process')
let proc = new Processor(root,path.basename(file))
proc.root.index(proc)

proc.process()
console.timeEnd('process')

console.time('generation')
let generated = proc.root.generate(proc)
console.timeEnd('generation')

console.time('execution')
generated.run(new Runtime(generated))
console.timeEnd('execution')