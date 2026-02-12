
import fs from 'fs';

try {
    const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));
    const schemaRef = "Ideris.Core.Lib.Model.RestModels.InternalApi.Sku.StockApi";
    const schema = swagger.components.schemas[schemaRef];

    let output = "";
    if (schema) {
        output += `\n--- Schema: ${schemaRef} ---\n`;
        output += JSON.stringify(schema, null, 2);
    } else {
        output += "Schema not found\n";
        // output += Object.keys(swagger.components.schemas).join('\n');
    }
    fs.writeFileSync('schema.txt', output, 'utf8');
    console.log("Schema written to schema.txt");

} catch (error) {
    console.error("Error:", error.message);
}
