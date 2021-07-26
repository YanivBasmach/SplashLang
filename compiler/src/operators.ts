

export enum BinaryOperator {
    plus = '+',
    minus = '-',
    mul = '*',
    div = '/',
    mod = '%',
    pow = '**',
    int_div = '//',
    lt = '<',
    gt = '>',
    le = '<=',
    ge = '>=',
    equals = '==',
    ne = '!=',
    is = 'is',
    in = 'in',
    as = 'as',
    range = '..',
    and = '&&',
    or = '||',
    default = '~'
}

export enum UnaryOperator {
    plus = '+',
    minus = '-',
    not = '!',
    range = '..'
}

export enum AssignmentOperator {
    set = '=',
    add = '+=',
    sub = '-=',
    mul = '*=',
    div = '/=',
    mod = '%=',
    int_div = '//=',
    pow = '**='
}

export enum Modifier {
    private,
    protected,
    abstract,
    native,
    final,
    static,
    readonly,
    operator,
    iterator,
    get,
    set,
    indexer,
    accessor,
    assigner,
    invoker
}
