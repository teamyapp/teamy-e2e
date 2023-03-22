import { expect } from '@playwright/test';
import { test } from '../playwright/fixtures';

test('Create & remove team', async ({page}) => {
    await page
        .goto(process.env.TEAMY_WEB_BASE_URL);
    const selectTeamRegion = await page
        .getByRole('region', {
            name: 'Select Active Team'
        });
    await selectTeamRegion
        .getByRole('button', {
            name: 'add'
        })
        .click();
    const createTeamModal = await page
        .getByRole('dialog', {
            name: 'Create Team'
        });
    await expect(createTeamModal).toHaveAttribute('data-fully-opened', 'true');
    const newTeamName = 'Test Team';
    await createTeamModal
        .getByLabel('Name')
        .getByRole('textbox')
        .fill(newTeamName);
    await createTeamModal
        .getByRole('button', {
            name: 'Create'
        })
        .click();
    await expect(createTeamModal).toHaveAttribute('data-fully-closed', 'true');
    await selectTeamRegion
        .getByRole('listitem', {name: newTeamName})
        .first()
        .click();
    await expect(page).toHaveURL(/.+\/teams\/\d+\/sprints.*/);

    await page
        .locator('header')
        .getByRole('region', {
            name: 'leftSection'
        })
        .getByRole('button', {
            name: newTeamName
        })
        .click();
    const teamSettingModal = await page
        .getByRole('dialog', {name: 'Team Setting'});
    await expect(teamSettingModal).toHaveAttribute('data-fully-opened', 'true');
    await teamSettingModal
        .getByRole('button', {name: 'Delete Team'})
        .click();
    await expect(teamSettingModal).toHaveAttribute('data-fully-closed', 'true');
    await expect(page).toHaveURL(/.+\/teams$/);
});
