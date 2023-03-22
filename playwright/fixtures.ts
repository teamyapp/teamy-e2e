import { expect, Page, test as baseTest } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { authenticator } from 'otplib';

type TestAccountType =
    | 'google'
    | 'github'
    | 'slack';

interface TestAccount {
    type: TestAccountType;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    totpSecret?: string;
    totpPasswordLength?: number;
}

const testAccounts: TestAccount[] = JSON.parse(process.env.TEST_ACCOUNTS || '[]');

export const test = baseTest.extend<{}, {
    workerStorageState: string
}>({
    // Use the same storage state for all tests in this worker.
    storageState: ({workerStorageState}, use) => use(workerStorageState),
    workerStorageState: [async ({browser}, use) => {
        const testInfo = test.info();
        const index = testInfo.parallelIndex;
        const fileName = path.resolve(testInfo.project.outputDir, `.auth/${index}.json`);
        if (fs.existsSync(fileName)) {
            // Reuse existing authentication state if any.
            await use(fileName);
            return;
        }

        // Make sure we authenticate in a clean environment by unsetting storage state.
        const page = await browser.newPage({storageState: undefined});
        const testAccount = getTestAccount(index);

        await signInTestAccount(page, testAccount);

        await page.context().storageState({path: fileName});
        await page.close();
        await use(fileName);
    }, {scope: 'worker'}]
});

async function signInTestAccount(page: Page, testAccount: TestAccount) {
    await page.goto(process.env.TEAMY_WEB_BASE_URL);
    await expect(page).toHaveURL(/.+\/cloud\/identity\/sign-in$/);

    switch (testAccount.type) {
        case 'google': {
            await page
                .getByRole('button', {name: 'Sign in with Google'})
                .click();
            await page
                .getByRole('textbox', {name: 'Email or phone'})
                .fill(testAccount.email);
            await page.click('text=Next');
            await page
                .getByRole('textbox', {name: 'Enter your password'})
                .fill(testAccount.password);
            await page.click('text=Next');
            break;
        }
        case 'github': {
            await page
                .getByRole('button', {name: 'Sign in with Github'})
                .click();
            await page
                .getByRole('textbox', {
                    name: 'Username or email address'
                })
                .fill(testAccount.email);
            await page
                .getByRole('textbox', {
                    name: 'Password'
                })
                .fill(testAccount.password);
            await page
                .getByRole('button', {name: 'Sign in'})
                .click();
            await page.waitForURL(/github.com\/sessions\/two-factor\/app/);
            const otp = generateTOTP(testAccount.totpSecret, testAccount.totpPasswordLength || 6);
            await page
                .locator('#app_totp')
                .fill(otp);
            break;
        }
    }

    await Promise.race([
        page.waitForURL(/.+github.com\/login\/oauth\/authorize/, {
            waitUntil: 'networkidle'
        }),
        page.waitForURL(/.+\/sign-up.*/, {
            waitUntil: 'networkidle'
        }),
        page.waitForURL(/.+\/teams.*/, {
            waitUntil: 'networkidle'
        })
    ]);

    if (page.url().match(/github.com\/login\/oauth\/authorize/)) {
        const authorizeButton = await page.getByRole('button', {
            name: `Authorize`,
        });
        if (authorizeButton) {
            await authorizeButton.click();
        }

        await Promise.race([
            page.waitForURL(/.+\/sign-up.*/),
            page.waitForURL(/.+\/teams.*/)
        ]);
    }

    if (page.url().match(/.+\/sign-up*./)) {
        await page
            .getByLabel('First Name')
            .getByRole('textbox')
            .fill(testAccount.firstName);
        await page
            .getByLabel('Last Name')
            .getByRole('textbox')
            .fill(testAccount.lastName);
        await page
            .getByRole('button', {name: 'Create Account'})
            .click();
    }

    await expect(page).toHaveURL(/.+\/teams.*/);
}

function getTestAccount(index: number): TestAccount {
    return testAccounts[index];
}

function generateTOTP(secret: string, passwordLength: number): string {
    authenticator.options = {
        ...authenticator.options,
        digits: passwordLength,
    };
    return authenticator.generate(secret);
}