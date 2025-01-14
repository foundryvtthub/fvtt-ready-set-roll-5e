import { MODULE_NAME } from "../module/const.js";
import { CoreUtility } from "./core.js";
import { LogUtility } from "./log.js";
import { RollUtility } from "./roll.js";
import { SettingsUtility, SETTING_NAMES } from "./settings.js";
import { SheetUtility } from "./sheet.js";

/**
 * Utility class to handle patching of core Foundry VTT functions, mostly roll-related.
 */
export class PatchingUtility {
    /**
     * Patches actor sheet rolls: skills, ability checks, and ability saves.
     */
    static patchActors() {
        LogUtility.log("Patching Actor Rolls");
        const actorPrototype = "CONFIG.Actor.documentClass.prototype";

        if (SettingsUtility.getSettingValue(SETTING_NAMES.QUICK_SKILL_ENABLED)) {
            libWrapper.register(MODULE_NAME, `${actorPrototype}.rollSkill`, _actorRollSkill, "MIXED");
        }

        if (SettingsUtility.getSettingValue(SETTING_NAMES.QUICK_ABILITY_ENABLED)) {
            libWrapper.register(MODULE_NAME, `${actorPrototype}.rollAbilityTest`, _actorRollAbilityTest, "MIXED");
            libWrapper.register(MODULE_NAME, `${actorPrototype}.rollAbilitySave`, _actorRollAbilitySave, "MIXED");
        }
    }

    /**
     * Patches item rolls: weapons, features, tools, spells, etc.
     */
    static patchItems() {
        LogUtility.log("Patching Item Rolls");
        const itemPrototype = "CONFIG.Item.documentClass.prototype";

        if (SettingsUtility.getSettingValue(SETTING_NAMES.QUICK_ITEM_ENABLED)) {            
            libWrapper.register(MODULE_NAME, `${itemPrototype}.use`, _itemUse, "MIXED");
        }
    }

    /**
     * Patches item sheets: quick roll configuration tabs, and damage context fields.
     */
    static patchItemSheets() {        
        LogUtility.log("Patching Item Sheets");
        const itemSheetPrototype = "ItemSheet.prototype";

        if (SettingsUtility.getSettingValue(SETTING_NAMES.QUICK_ITEM_ENABLED)) {  
            libWrapper.register(MODULE_NAME, `${itemSheetPrototype}._onChangeTab`, _onChangeTab, "OVERRIDE");
        }
    }
}

/**
 * Patch function for rolling an Actor skill.
 * @param {function} wrapper The original wrapper for the function.
 * @param {String} skillId The id of the skill being rolled.
 * @param {*} options Options for processing the roll.
 * @returns {Promise<Roll>} The generated roll for the Actor skill.
 * @private
 */
async function _actorRollSkill(wrapper, skillId, options) {
    const { roll, ignore } = await _actorProcessWrapper(this, wrapper, options, skillId);

    return ignore ? roll : RollUtility.rollSkill(this, skillId, roll);
}

/**
 * Patch function for rolling an Actor ability test.
 * @param {function} wrapper The original wrapper for the function.
 * @param {String} skillId The id of the ability being rolled.
 * @param {*} options Options for processing the roll.
 * @returns {Promise<Roll>} The generated roll for the Actor ability test.
 * @private
 */
async function _actorRollAbilityTest(wrapper, ability, options) {
    const { roll, ignore } = await _actorProcessWrapper(this, wrapper, options, ability);

    return ignore ? roll : RollUtility.rollAbilityTest(this, ability, roll);
}

/**
 * Patch function for rolling an Actor ability save.
 * @param {function} wrapper The original wrapper for the function.
 * @param {String} skillId The id of the ability being rolled.
 * @param {*} options Options for processing the roll.
 * @returns {Promise<Roll>} The generated roll for the Actor ability save.
 * @private
 */
async function _actorRollAbilitySave(wrapper, ability, options) {
    const { roll, ignore } = await _actorProcessWrapper(this, wrapper, options, ability);

    return ignore ? roll : RollUtility.rollAbilitySave(this, ability, roll);
}

/**
 * Patch function for rolling an Item usage.
 * @param {function} wrapper The original wrapper for the function.
 * @param {*} options Options for processing the item usage.
 * @returns {Promise<ChatMessage|object|void>} The generated chat data for the Item usage.
 * @private
 */
async function _itemUse(wrapper, options) {
    options = foundry.utils.mergeObject({ event: window.event }, options, { recursive: false });

    //TO-DO: generate roll config from set flags in sheet, see item.mjs -> use()
    //idea is to get flags from sheet and change config to let the system handle all consumption/etc.
    return await _itemProcessWrapper(this, wrapper, options);
}

/**
 * Process the wrapper for an Actor roll and bypass quick rolling if necessary.
 * @param {Actor} caller The calling object of the wrapper.
 * @param {function} wrapper The original wrapper to process.
 * @param {*} options Options for processing the wrapper.
 * @param {String} id The associated id of the Actor roll (eg. skill id).
 * @returns {Promise<Roll>} The processed roll data from the wrapper.
 * @private
 */
async function _actorProcessWrapper(caller, wrapper, options, id) {
    if (options?.chatMessage === false || options?.vanilla) {
        return { roll: wrapper.call(caller, id, options), ignore: true };
    }

    // For actor rolls, the alternate item roll setting doesn't matter for ignoring quick roll, only the alt key.
    const ignore = options?.event?.altKey ?? false;
    return { roll: await RollUtility.rollActorWrapper(caller, wrapper, options, id, ignore), ignore };
}

/**
 * Process the wrapper for an Item roll and bypass quick rolling if necessary.
 * @param {Item} caller The calling object of the wrapper.
 * @param {function} wrapper The original wrapper to process.
 * @param {*} config Configuration for processing the item.
 * @param {*} options Options for processing the wrapper.
 * @returns {Promise<ChatMessage>} The processed chat data for the wrapper.
 * @private
 */
async function _itemProcessWrapper(caller, wrapper, options) {
    if (options?.chatMessage === false || options?.vanilla) {
		return wrapper.call(caller, options);
	}

    // For item rolls, check the alternate item roll setting to see if the alt key should ignore quick roll.
    const ignore = (options?.event?.altKey && !CoreUtility.eventToAltRoll(options?.event)) ?? false;
    return await RollUtility.rollItemWrapper(caller, wrapper, options, ignore);
}

/**
 * Override function that ensures tab height is automatically scaled when changing tabs.
 * @param {*} event The triggering event.
 * @param {Tabs} tabs The list of navigation tabs in the sheet.
 * @param {String} active The currently active tab.
 * @private
 */
function _onChangeTab(event, tabs, active) {
    SheetUtility.setAutoHeightOnSheet(this);
}