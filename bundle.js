const fs = require('fs');
const path = require('path');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const  babel = require('babel-core');


let ID = 0;

/**
 * @description 解析文件内容
 * @param {string} filename 
 * @returns {number, string, array, string} 
 * id: 根据文件名读取文件内容，给每个文件一个唯一的id
 * code: 将内容使用babek编译成浏览器支持的语法
 * dependencies：返回该文件依赖的其他文件
 */
function createAsset(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const ast = babylon.parse(content, {
        sourceType: 'module'
    });

    const dependencies = [];

    traverse(ast, {
        ImportDeclaration: (({node}) => {
            dependencies.push(node.source.value)
        })
    });

    const id = ID++;

    const {code} = babel.transformFromAst(ast, null, {
        presets: ['env']
    });

    return {
        id,
        filename,
        dependencies,
        code
    }
}

/**
 * @description 使用递归，解析所有依赖文件，并插入到队列返回
 * @param {string} entry 
 */
function createGraph(entry) {
    const mainAsset = createAsset(entry);
    const queue = [mainAsset];
    for(let asset of queue) {
        const dirname = path.dirname(asset.filename);
        asset.mapping = {};
        asset.dependencies.forEach(relativePath => {
            const absolutePath = path.join(dirname, relativePath);
            const child = createAsset(absolutePath);
            asset.mapping[relativePath] = child.id;
            queue.push(child);
        })
    }
    return queue;
}

/**
 * @description 将内容转换为字符串，并执行入口文件
 * @param {array} graph 
 */
function bundle(graph) {
    let modules = '';
    graph.forEach(mod => {
        modules += `${mod.id}: [
            function (require, module, exports) {
                ${mod.code}
            },
            ${JSON.stringify(mod.mapping)}
        ],`;
    })
    const result = `
    (function(modules){
        function require(id){
            const [fn, mapping] = modules[id];
            function localRequire(relativePath){
                return require(mapping[relativePath]);
            }
            const module = {exports:{}};
            fn(localRequire,module,module.exports);
            return module.exports;
        }
        require(0);
    })({${modules}})
  `;
    
    return result;
}

const graph = createGraph('./example/entry.js') 

const result = bundle(graph);

console.log(result)