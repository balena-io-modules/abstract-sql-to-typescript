import * as program from 'commander';
import * as fs from 'fs';
import type { AbstractSqlModel } from '@balena/abstract-sql-compiler';

function readFile(inputFile: string) {
	return fs.readFileSync(inputFile, 'utf8');
}

async function runCompile(inputFile: string, outputFile: string | undefined) {
	const { abstractSqlToTypescriptTypes } = await import('./');
	const abstractSqlModel = JSON.parse(readFile(inputFile)) as AbstractSqlModel;
	const tsTypes = abstractSqlToTypescriptTypes(abstractSqlModel);
	if (!outputFile) {
		console.log(tsTypes);
	} else {
		fs.writeFileSync(outputFile, tsTypes);
	}
}

// tslint:disable-next-line:no-var-requires
program.version(require('../package.json').version);

program
	.command('compile <input-file> [output-file]')
	.description(
		'Generate model typings based on the provided abstract sql model',
	)
	.action(runCompile);

program
	.command('help')
	.description('print the help')
	.action(function () {
		program.help();
	});

program['arguments']('<input-file> [output-file]').action(runCompile);

if (process.argv.length === 2) {
	program.help();
}

program.parse(process.argv);
