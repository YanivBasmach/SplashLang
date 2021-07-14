import {Tokenizer} from './tokenizer'
import * as fs from 'fs'
import { Parser } from './parser'

const file = './test.splash'

const input = fs.readFileSync(file).toString('utf-8')

let tokenizer = new Tokenizer(input)

let parser = new Parser(file, tokenizer)

let root = parser.parseFile()

console.log('done compilation!')
console.log(JSON.stringify(root,undefined,2))
