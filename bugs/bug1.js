var content = (function () {
    return `

    /* TypedArray.prototype.toString must be the same object as Array.prototype.toString */
    JSValue obj = JS_GetProperty(ctx, ctx->class_proto[JS_CLASS_ARRAY], JS_ATOM_toString);
    /* XXX: should use alias method in JSCFunctionListEntry */ //@@@`
})

var repl = content();

var rets = repl.matchAll(/(\n|^)[^"\n]*?\/\*(([\s\S\n])*?)\*\/|(\n|^)[^"\n]*?\/\/(.*)/g);

var matchs = Array.from(rets, (m)=>{
    return m[2] || m[5];
});

console.log(matchs)