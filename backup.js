document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('backupFileInput');
  const message = document.getElementById('message');
  const importFlow = document.getElementById('importFlow');
  const preview = document.getElementById('preview');
  const successPanel = document.getElementById('successPanel');
  const groupsPreviewContent = document.getElementById('groupsPreviewContent');
  const rulesPreviewContent = document.getElementById('rulesPreviewContent');
  const settingsPreviewContent = document.getElementById('settingsPreviewContent');
  const groupsCheckbox = document.getElementById('importGroupsCheckbox');
  const rulesCheckbox = document.getElementById('importRulesCheckbox');
  const settingsCheckbox = document.getElementById('importSettingsCheckbox');
  const importSelectedBtn = document.getElementById('importSelectedBtn');
  const importAnotherBtn = document.getElementById('importAnotherBtn');

  const SETTING_LABELS = {
    isEnabled: 'Auto-grouping',
    ignorePinnedTabs: 'Ignore pinned tabs',
    tabPlacement: 'Tab placement',
    strictRules: 'Strict rules',
    regroupGroupedTabs: 'Regroup grouped tabs'
  };
  const SUPPORTED_GROUP_COLORS = new Set(['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);

  let selectedBackup = null;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    clearMessage();
    hidePreview();

    try {
      selectedBackup = JSON.parse(await file.text());
      const previewData = validateBackupPreview(selectedBackup);
      showPreview(previewData);
    } catch (error) {
      selectedBackup = null;
      showMessage(error.message || 'Invalid backup file', 'error');
    }
  });

  rulesCheckbox.addEventListener('change', syncRuleDependency);

  importSelectedBtn.addEventListener('click', async () => {
    if (!selectedBackup) {
      showMessage('Choose a backup file before importing.', 'error');
      return;
    }

    const sections = {
      groups: groupsCheckbox.checked,
      rules: rulesCheckbox.checked,
      settings: settingsCheckbox.checked
    };

    if (!sections.groups && !sections.rules && !sections.settings) {
      showMessage('Select at least one section to import.', 'error');
      return;
    }

    importSelectedBtn.disabled = true;
    importSelectedBtn.textContent = 'Importing...';
    clearMessage();

    try {
      await sendMessage({
        action: 'importBackup',
        backup: selectedBackup,
        sections
      });

      showSuccessState();
    } catch (error) {
      showMessage(error.message || 'Failed to import backup.', 'error');
    }

    importSelectedBtn.disabled = false;
    importSelectedBtn.textContent = 'Import selected';
  });

  importAnotherBtn.addEventListener('click', () => {
    resetImportFlow();
    fileInput.focus();
  });

  function showPreview(previewData) {
    renderBackupContents(previewData);

    groupsCheckbox.checked = true;
    rulesCheckbox.checked = true;
    settingsCheckbox.checked = previewData.hasSettings;
    settingsCheckbox.disabled = !previewData.hasSettings;
    syncRuleDependency();
    preview.classList.add('visible');
  }

  function hidePreview() {
    preview.classList.remove('visible');
    groupsPreviewContent.replaceChildren();
    rulesPreviewContent.replaceChildren();
    settingsPreviewContent.replaceChildren();
  }

  function showSuccessState() {
    selectedBackup = null;
    fileInput.value = '';
    clearMessage();
    hidePreview();
    importFlow.hidden = true;
    successPanel.classList.add('visible');
  }

  function resetImportFlow() {
    selectedBackup = null;
    fileInput.value = '';
    clearMessage();
    hidePreview();
    resetCheckboxes();
    successPanel.classList.remove('visible');
    importFlow.hidden = false;
  }

  function resetCheckboxes() {
    groupsCheckbox.checked = true;
    groupsCheckbox.disabled = false;
    rulesCheckbox.checked = false;
    settingsCheckbox.checked = false;
    settingsCheckbox.disabled = true;
  }

  function syncRuleDependency() {
    if (rulesCheckbox.checked) {
      groupsCheckbox.checked = true;
      groupsCheckbox.disabled = true;
    } else {
      groupsCheckbox.disabled = false;
    }
  }

  function validateBackupPreview(backup) {
    if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
      throw new Error('Backup file must contain a JSON object.');
    }

    if (backup.version !== 1) {
      throw new Error('Unsupported backup version.');
    }

    if (!Array.isArray(backup.groups)) {
      throw new Error('Backup groups must be an array.');
    }

    if (!Array.isArray(backup.rules)) {
      throw new Error('Backup rules must be an array.');
    }

    if (backup.settings !== undefined && (!backup.settings || typeof backup.settings !== 'object' || Array.isArray(backup.settings))) {
      throw new Error('Backup settings must be an object.');
    }

    return {
      groups: backup.groups,
      rules: backup.rules,
      settings: backup.settings || null,
      hasSettings: Boolean(backup.settings)
    };
  }

  function renderBackupContents(previewData) {
    renderGroupsPreview(previewData.groups);
    renderRulesPreview(previewData.rules, previewData.groups);
    renderSettingsPreview(previewData.settings);
  }

  function renderGroupsPreview(groups) {
    if (groups.length === 0) {
      groupsPreviewContent.replaceChildren(createEmptyState('No groups in this backup.'));
      return;
    }

    groupsPreviewContent.replaceChildren(...groups.map(group => {
      const name = typeof group.name === 'string' && group.name.trim() ? group.name : 'Unnamed group';
      const color = typeof group.color === 'string' && group.color.trim() ? group.color : 'No color';
      const swatchColor = SUPPORTED_GROUP_COLORS.has(color) ? color : null;

      return createConfigRow({
        title: name,
        meta: `${capitalize(color)} color`,
        color: swatchColor
      });
    }));
  }

  function renderRulesPreview(rules, groups) {
    if (rules.length === 0) {
      rulesPreviewContent.replaceChildren(createEmptyState('No rules in this backup.'));
      return;
    }

    const groupDetails = new Map();
    groups.forEach(group => {
      if (typeof group.groupId === 'string' && group.groupId.trim()) {
        const name = typeof group.name === 'string' && group.name.trim() ? group.name : group.groupId;
        const color = typeof group.color === 'string' && group.color.trim() ? group.color : null;
        groupDetails.set(group.groupId, {
          name,
          color: SUPPORTED_GROUP_COLORS.has(color) ? color : null
        });
      }
    });

    rulesPreviewContent.replaceChildren(...rules.map(rule => {
      const pattern = typeof rule.pattern === 'string' && rule.pattern.trim() ? rule.pattern : 'Missing pattern';
      const type = rule.type || 'simple';
      const groupId = typeof rule.groupId === 'string' && rule.groupId.trim() ? rule.groupId : 'Missing group ID';
      const groupDetail = groupDetails.get(groupId);
      const groupLabel = groupDetail ? groupDetail.name : 'Missing group';

      return createConfigRow({
        title: pattern,
        meta: groupLabel,
        color: groupDetail ? groupDetail.color : null,
        badge: formatRuleType(type),
        badgeClass: type === 'regex' ? 'regex' : ''
      });
    }));
  }

  function renderSettingsPreview(settings) {
    if (!settings) {
      settingsPreviewContent.replaceChildren(createEmptyState('No settings in this backup.'));
      return;
    }

    const supportedEntries = Object.entries(SETTING_LABELS)
      .filter(([key]) => Object.prototype.hasOwnProperty.call(settings, key));

    if (supportedEntries.length === 0) {
      settingsPreviewContent.replaceChildren(createEmptyState('No supported settings in this backup.'));
      return;
    }

    settingsPreviewContent.replaceChildren(...supportedEntries.map(([key, label]) => (
      createConfigRow({
        title: label,
        meta: formatSettingValue(key, settings[key])
      })
    )));
  }

  function createConfigRow({ title, meta, color, badge, badgeClass }) {
    const row = document.createElement('div');
    row.className = 'config-item';

    const info = document.createElement('div');
    info.className = 'config-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'config-pattern';

    const titleText = document.createElement('span');
    titleText.textContent = title;
    titleEl.appendChild(titleText);

    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = `pattern-type-indicator ${badgeClass || ''}`.trim();
      badgeEl.textContent = badge;
      titleEl.appendChild(badgeEl);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'config-group';

    if (color) {
      const colorEl = document.createElement('div');
      colorEl.className = `config-color color-${color}`;
      metaEl.appendChild(colorEl);
    }

    const metaText = document.createElement('span');
    metaText.textContent = meta;
    metaEl.appendChild(metaText);

    info.append(titleEl, metaEl);
    row.appendChild(info);
    return row;
  }

  function createEmptyState(text) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = text;
    return emptyState;
  }

  function formatSettingValue(key, value) {
    if (typeof value === 'boolean') {
      return value ? 'Enabled' : 'Disabled';
    }

    if (key === 'tabPlacement') {
      return value === 'first' ? 'First tab' : value === 'last' ? 'Last tab' : String(value);
    }

    return String(value);
  }

  function formatRuleType(type) {
    return type === 'regex' ? 'Regex' : 'Simple';
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type} visible`;
  }

  function clearMessage() {
    message.textContent = '';
    message.className = 'message';
  }

  function sendMessage(payload) {
    return new Promise((resolve, reject) => {
      browser.runtime.sendMessage(payload, (response) => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
});
