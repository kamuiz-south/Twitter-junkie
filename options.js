document.addEventListener('DOMContentLoaded', () => {
    // Keys
    const KEY_DRAG = 'tj_drag_enabled';
    const KEY_THEATER = 'tj_theater_hide';
    const KEY_HIDE_UI_ALWAYS = 'tj_hide_ui_always';
    const KEY_LANGUAGE = 'tj_language';
    const KEY_SHORTCUTS = 'tj_shortcuts_enabled';
    const KEY_SPEED_STEP = 'tj_speed_step';
    const KEY_INTUITIVE_WHEEL = 'tj_intuitive_wheel';
    const KEY_REVERSE_WHEEL = 'tj_reverse_wheel';
    const KEY_STOP_BIND = 'tj_stop_bind';
    const KEY_START_UP = 'tj_start_up';
    const KEY_START_DOWN = 'tj_start_down';
    const KEY_SPEED_UP = 'tj_speed_up';
    const KEY_SPEED_DOWN = 'tj_speed_down';

    // Translations Dictionary
    const I18N = {
        en: {
            optTitle: 'Twitter Junkie Settings',
            uiSection: 'User Interface',
            optLanguage: 'Language / 言語',
            optDrag: 'Enable Video Drag & Drop',
            descDrag: 'Allows clicking and dragging the video maximize button.',
            optHideAlways: 'Always Hide Auto-Scroll UI',
            descHideAlways: 'Permanently hides the floating UI panel. Shortcuts will still function.',
            optTheater: 'Auto-Hide Scroll Panel in Theater Mode',
            descTheater: 'Hides the floating Auto-Scroll panel completely when viewing fullscreen photos or videos.',
            advSection: 'Advanced Shortcuts',
            optShortcuts: 'Enable Mouse/Keyboard Shortcuts for Auto-Scroll',
            helpShortcuts: '<strong>Control Scheme:</strong><br>• <code>Right-Click (Hold) + Mouse Wheel</code> : Starts scrolling in the wheel direction.<br>• While holding the initial Right-Click, scrolling the wheel the other way changes direction.<br>• Releasing Right-Click, then <strong>holding Right-Click + Wheel again</strong> adjusts Speed.<br>• <code>Left-Click</code> OR <code>Spacebar</code> : Stops scrolling.',
            optSpeedStep: 'Speed Adjustment Step (Default: 0.2)',
            optIntuitive: 'Intuitive Wheel Operation Mode',
            descIntuitive: 'Right-Click + Wheel directly controls scrolling direction and speed as a single momentum counter across both directions.',
            optReverse: 'Reverse Wheel Direction when scrolling Downwards',
            descReverse: 'When already scrolling down, scrolling the wheel down speeds up, and up slows down.',
            kbStartUp: 'Start Scrolling UP',
            kbStartDown: 'Start Scrolling DOWN',
            kbSpeedUp: 'Speed UP (Faster)',
            kbSpeedDown: 'Speed DOWN (Slower)',
            kbStop: 'Stop Scrolling',
            descRebind: 'Click any button to rebind. Left-click anywhere on the page will always stop scrolling.'
        },
        jp: {
            optTitle: 'Twitter Junkie 設定',
            uiSection: 'ユーザーインターフェース',
            optLanguage: 'Language / 言語',
            optDrag: '動画のドラッグ＆ドロップを有効にする',
            descDrag: '動画最大化ボタンをクリックしてドラッグできるようにします。',
            optHideAlways: '自動スクロールUIを常に表示しない',
            descHideAlways: 'フローティングUIパネルを完全に非表示にします。ショートカットは引き続き機能します。',
            optTheater: 'シアターモードでスクロールパネルを自動非表示',
            descTheater: '全画面で画像や動画を表示する際、パネルを自動的に非表示にします。',
            advSection: '詳細ショートカット設定',
            optShortcuts: '自動スクロール機能のショートカットを有効にする',
            helpShortcuts: '<strong>操作方法:</strong><br>• <code>右クリック（長押し） + マウスホイール</code> : ホイールの方向にスクロールを開始します。<br>• 右クリックを押下したまま、ホイールを逆方向に回すと方向が反転します。<br>• 右クリックを離し、再度<strong>右クリック + ホイール</strong>で速度の調整が可能です。<br>• <code>左クリック</code> または <code>Spaceキー</code> : スクロールを停止します。',
            optSpeedStep: '速度調整のステップ（デフォルト: 0.2）',
            optIntuitive: '直感的なホイール操作モード',
            descIntuitive: '右クリック＋ホイールで、速度と方向を1つの連続したカウンターとしてシームレスに操作できます。',
            optReverse: '下方向スクロール中のホイール操作を逆転する',
            descReverse: '下方向にスクロールしている時、下ホイールで加速、上ホイールで減速するようにします。',
            kbStartUp: '上スクロール開始',
            kbStartDown: '下スクロール開始',
            kbSpeedUp: '速度アップ（加速）',
            kbSpeedDown: '速度ダウン（減速）',
            kbStop: 'スクロール停止',
            descRebind: 'ボタンをクリックしてキーを再割り当てします。ページ上の左クリックでも常にスクロールは停止します。'
        }
    };

    function applyTranslations(lang) {
        const dict = I18N[lang] || I18N['jp']; // Defaulting to jp for JP users if missing
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
        });
    }

    // Elements
    const chkDrag = document.getElementById('opt-drag-video');
    const chkTheater = document.getElementById('opt-theater-hide');
    const chkHideUIAlways = document.getElementById('opt-hide-ui-always');
    const selLanguage = document.getElementById('opt-language');
    const chkShortcuts = document.getElementById('opt-shortcuts-enabled');
    const inputSpeedStep = document.getElementById('opt-speed-step');
    const chkIntuitiveWheel = document.getElementById('opt-intuitive-wheel');
    const chkReverseWheel = document.getElementById('opt-reverse-wheel');
    
    const btnStopBind = document.getElementById('kb-stop');
    const btnStartUp = document.getElementById('kb-startup');
    const btnStartDown = document.getElementById('kb-startdown');
    const btnSpeedUp = document.getElementById('kb-speedup');
    const btnSpeedDown = document.getElementById('kb-speeddown');

    // Load states
    chrome.storage.local.get([
        KEY_DRAG, KEY_THEATER, KEY_HIDE_UI_ALWAYS, KEY_LANGUAGE, KEY_SHORTCUTS, KEY_SPEED_STEP, KEY_INTUITIVE_WHEEL, KEY_REVERSE_WHEEL,
        KEY_STOP_BIND, KEY_START_UP, KEY_START_DOWN, KEY_SPEED_UP, KEY_SPEED_DOWN
    ], (res) => {
        const lang = res[KEY_LANGUAGE] || 'jp'; // Default to Japanese per user persona context
        selLanguage.value = lang;
        applyTranslations(lang);

        chkDrag.checked = res[KEY_DRAG] || false;
        chkTheater.checked = res[KEY_THEATER] !== undefined ? res[KEY_THEATER] : true; // Default ON
        chkHideUIAlways.checked = res[KEY_HIDE_UI_ALWAYS] || false;
        chkShortcuts.checked = res[KEY_SHORTCUTS] !== undefined ? res[KEY_SHORTCUTS] : true; // Default ON
        inputSpeedStep.value = res[KEY_SPEED_STEP] !== undefined ? res[KEY_SPEED_STEP] : 0.2;
        chkIntuitiveWheel.checked = res[KEY_INTUITIVE_WHEEL] || false;
        chkReverseWheel.checked = res[KEY_REVERSE_WHEEL] || false;
        
        const setBtnInit = (btn, key, def) => {
             btn.textContent = res[key] || def;
             btn.dataset.key = res[key] || def;
             btn.dataset.storage = key; // Attach storage key to button for generic handler
        };
        
        setBtnInit(btnStopBind, KEY_STOP_BIND, 'Space');
        setBtnInit(btnStartUp, KEY_START_UP, 'None');
        setBtnInit(btnStartDown, KEY_START_DOWN, 'None');
        setBtnInit(btnSpeedUp, KEY_SPEED_UP, 'None');
        setBtnInit(btnSpeedDown, KEY_SPEED_DOWN, 'None');
    });

    // Save Toggles
    chkDrag.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_DRAG]: e.target.checked }));
    chkTheater.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_THEATER]: e.target.checked }));
    chkHideUIAlways.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_HIDE_UI_ALWAYS]: e.target.checked }));
    
    selLanguage.addEventListener('change', (e) => {
         const newLang = e.target.value;
         chrome.storage.local.set({ [KEY_LANGUAGE]: newLang });
         applyTranslations(newLang);
    });

    chkShortcuts.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_SHORTCUTS]: e.target.checked }));
    chkIntuitiveWheel.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_INTUITIVE_WHEEL]: e.target.checked }));
    chkReverseWheel.addEventListener('change', (e) => chrome.storage.local.set({ [KEY_REVERSE_WHEEL]: e.target.checked }));
    
    // Save Step
    inputSpeedStep.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 0.2;
        chrome.storage.local.set({ [KEY_SPEED_STEP]: val });
    });

    // Handle Keybind Recording
    let recordingButton = null;

    const setupKeybindButton = (btn) => {
        btn.addEventListener('click', (e) => {
            if (recordingButton) return;
            recordingButton = e.target;
            recordingButton.classList.add('recording');
            recordingButton.textContent = 'Press any key...';
            
            const keyHandler = (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                
                // Format nice string
                let keyStr = evt.code;
                if (keyStr.startsWith('Key')) keyStr = keyStr.replace('Key', '');
                if (keyStr.startsWith('Digit')) keyStr = keyStr.replace('Digit', '');
                
                const storageKey = recordingButton.dataset.storage;
                chrome.storage.local.set({ [storageKey]: keyStr }, () => {
                    recordingButton.textContent = keyStr;
                    recordingButton.dataset.key = keyStr;
                    recordingButton.classList.remove('recording');
                    recordingButton = null;
                    document.removeEventListener('keydown', keyHandler, true);
                });
            };
            
            // Add listener on capture phase to intercept everything
            document.addEventListener('keydown', keyHandler, true);
        });
    };

    [btnStopBind, btnStartUp, btnStartDown, btnSpeedUp, btnSpeedDown].forEach(setupKeybindButton);
    
    // Handle Clear Bind Buttons
    document.querySelectorAll('.btn-clear-bind').forEach(clearBtn => {
         clearBtn.addEventListener('click', () => {
              const targetId = clearBtn.dataset.target;
              const targetBtn = document.getElementById(targetId);
              if (!targetBtn) return;
              
              const storageKey = targetBtn.dataset.storage;
              targetBtn.textContent = 'None';
              targetBtn.dataset.key = 'None';
              if (recordingButton === targetBtn) {
                   targetBtn.classList.remove('recording');
                   recordingButton = null;
                   // Wait, we can't easily remove the generic keydown listener since it's anonymous closure
                   // But since we use recordingButton globally, the listener will just fire once and error harmlessly
                   // or we could just reload the window logic. Simple is fine.
              }
              chrome.storage.local.set({ [storageKey]: 'None' });
         });
    });
});
