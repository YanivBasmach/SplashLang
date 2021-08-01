import { SplashScript } from "./generator"
import * as fs from 'fs'
import * as paths from 'path'
import { Parser } from "./parser"
import { BaseTokenizer } from "./tokenizer"
import { Processor } from "./processor"
import { RootNode } from "./ast"
import { NativeFunctions, NativeMethods } from "./native"

export function initNatives() {
    let proc = new Processor()

    NativeFunctions.init(proc)
    NativeMethods.init(proc)
}

export function compileModule(path: string, sdk?: SplashModule) {
    let module = new SplashModule(paths.normalize(path))
    let asts: {[file: string]: RootNode} = {}

    let proc = new Processor()

    if (sdk) {
        proc.import(sdk)
    }

    for (let f of fs.readdirSync(path)) {
        if (paths.extname(f) == '.splash') {
            let fp = paths.join(path,f)
            let ast = parseFile(fp)
            if (ast) {
                asts[f] = ast
                proc.importAST(ast)
            }
        }
    }

    for (let e of Object.entries(asts)) {
        let script = processAndGenerate(proc,e[1],e[0])
        if (script) {
            module.scripts.push(script)
        } else {
            module.valid = false
        }
    }
    return module
}

export function compileFile(file: string, sdk: SplashModule): SplashScript | undefined {
    let root = parseFile(file)
    if (root) {
        let proc = new Processor()

        if (sdk) {
            proc.import(sdk)
        }
        let script = processAndGenerate(proc,root,file)
        return script
    }
    return
}

export function parseFile(file: string): RootNode | undefined {
    console.log('compiling script ' + file)
    console.time('compilation done')
    
    const input = fs.readFileSync(file).toString('utf-8')

    let tokenizer = new BaseTokenizer(input)
    let parser = new Parser(file, tokenizer)

    let root = parser.parseFile()
    console.timeEnd('compilation done')

    return parser.hasErrors ? undefined : root
}

export function processAndGenerate(proc: Processor, ast: RootNode, file: string) {
    console.log('processing...')
    console.time('processing done')
    
    proc.process(ast)
    console.timeEnd('processing done')

    if (!proc.hasErrors) {
        console.log('generating...')
        console.time('generation done')
        let generated = ast.generate(proc,file)
        console.timeEnd('generation done')
        return generated
    }
    return undefined
}

export class SplashModule {
    
    scripts: SplashScript[] = []
    valid: boolean = true

    constructor(public name: string) {

    }
}