import { SplashScript } from "./generator"
import * as fs from 'fs'
import * as paths from 'path'
import { Parser } from "./parser"
import { BaseTokenizer } from "./tokenizer"
import { Processor } from "./processor"
import { DummySplashType, SplashArray, SplashClass, SplashClassType, SplashInt, SplashString } from "./types"

export function compileModule(path: string, sdk?: SplashModule) {
    let module = new SplashModule(paths.normalize(path))
    for (let f of fs.readdirSync(path)) {
        if (paths.extname(f) == '.splash') {
            let fp = paths.join(path,f)
            let script = compileFile(fp,sdk)
            module.scripts.push(script)
        }
    }
    return module
}

export function compileFile(file: string, sdk?: SplashModule): SplashScript {
    console.log('compiling script ' + file)
    console.time('compilation done')
    
    const input = fs.readFileSync(file).toString('utf-8')

    let tokenizer = new BaseTokenizer(input)

    let parser = new Parser(file, tokenizer)

    let root = parser.parseFile()
    console.timeEnd('compilation done')
    
    console.log('processing...')
    console.time('processing done')
    let proc = new Processor(root,paths.basename(file))
    if (sdk) {
        proc.import(sdk)
    } else {
        proc.types.push(DummySplashType.null, DummySplashType.void)
    }
    proc.root.index(proc)

    proc.process()
    console.timeEnd('processing done')

    if (!proc.hasErrors) {
        console.log('generating...')
        console.time('generation done')
        let generated = proc.root.generate(proc)
        console.timeEnd('generation done')
        return generated
    }
    return new SplashScript(proc.file)
}

export class SplashModule {
    
    scripts: SplashScript[] = []

    constructor(public name: string) {

    }
}