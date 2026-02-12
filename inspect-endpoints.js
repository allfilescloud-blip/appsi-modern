
import fs from 'fs';

try {
    const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));
    const paths = ['/order/{orderId}', '/order/search', '/sku/stock', '/sku/code/{sku}'];

    let output = "";
    paths.forEach(path => {
        if (swagger.paths[path]) {
            output += `\n--- Path: ${path} ---\n`;
            Object.keys(swagger.paths[path]).forEach(method => {
                output += `Method: ${method.toUpperCase()}\n`;
                const op = swagger.paths[path][method];
                output += `Summary: ${op.summary}\n`;
                if (op.parameters) {
                    output += "Parameters:\n";
                    op.parameters.forEach(p => output += `  - ${p.name} (${p.in}): ${p.schema?.type}\n`);
                }
                if (op.requestBody) {
                    output += "Request Body:\n";
                    // Try to resolve ref if possible, or just dump structure
                    output += JSON.stringify(op.requestBody, null, 2) + "\n";
                }
            });
        }
    });
    fs.writeFileSync('endpoints_details.txt', output, 'utf8');
    console.log("Details written to endpoints_details.txt");

} catch (error) {
    console.error("Error:", error.message);
}
