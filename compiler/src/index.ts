import {Tokenizer} from './tokenizer'
import * as fs from 'fs'

const input = fs.readFileSync('./test.splash').toString('utf-8')

let tokenizer = new Tokenizer(input)

let tokens = []
while (tokenizer.canRead()) {
    tokens.push(tokenizer.next())
}

console.log(tokens + "")