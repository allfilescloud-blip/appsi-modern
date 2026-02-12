
import fs from 'fs';

try {
    const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));
    if (swagger.paths) {
        const keywords = ['order', 'pedido', 'sale', 'venda', 'checkout', 'product', 'sku', 'stock', 'estoque'];

        let output = "Searching for order/product/stock/sku related paths:\n";
        Object.keys(swagger.paths).forEach(path => {
            if (keywords.some(k => path.toLowerCase().includes(k))) {
                output += path + "\n";
            }
        });
        fs.writeFileSync('paths.txt', output, 'utf8');
        console.log("Paths written to paths.txt");
    } else {
        console.log("No paths found");
    }
} catch (error) {
    console.error("Error:", error.message);
}
