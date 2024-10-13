import type { DefaultTranslationsObject, Language } from '../types.js'

export const zhTwTranslations: DefaultTranslationsObject = {
  authentication: {
    account: '帳戶',
    accountOfCurrentUser: '目前使用者的帳戶',
    accountVerified: '帳戶驗證成功。',
    alreadyActivated: '已經啟用了',
    alreadyLoggedIn: '已經登入了',
    apiKey: 'API金鑰',
    authenticated: '經過身份驗證的',
    backToLogin: '返回登入頁面',
    beginCreateFirstUser: '首先，請建立您的第一個使用者。',
    changePassword: '更改密碼',
    checkYourEmailForPasswordReset: '請檢查您的電子郵件以獲取安全重設密碼的連結。',
    confirmGeneration: '確認生成',
    confirmPassword: '確認密碼',
    createFirstUser: '建立第一個使用者',
    emailNotValid: '提供的電子郵件無效',
    emailOrUsername: '電子郵件或使用者名稱',
    emailSent: '電子郵件已寄出',
    emailVerified: '電子郵件驗證成功。',
    enableAPIKey: '啟用API金鑰',
    failedToUnlock: '解鎖失敗',
    forceUnlock: '強制解鎖',
    forgotPassword: '忘記密碼',
    forgotPasswordEmailInstructions:
      '請在下方輸入您的電子郵件。您將收到一封有關如何重設密碼的說明電子郵件。',
    forgotPasswordQuestion: '忘記密碼？',
    forgotPasswordUsernameInstructions:
      '請在下方輸入您的使用者名稱。關於如何重設密碼的指示將會發送到與您的使用者名稱相關的電子郵件地址。',
    generate: '生成',
    generateNewAPIKey: '生成新的API金鑰',
    generatingNewAPIKeyWillInvalidate: '生成新的API金鑰將使之前的金鑰<1>失效</1>。您確定要繼續嗎？',
    lockUntil: '鎖定直到',
    logBackIn: '重新登入',
    loggedIn: '要使用另一個使用者登入前，您需要先<0>登出</0>。',
    loggedInChangePassword: '要更改您的密碼，請前往您的<0>帳戶</0>頁面並在那裡編輯您的密碼。',
    loggedOutInactivity: '您由於不活躍而被登出了。',
    loggedOutSuccessfully: '您已成功登出。',
    loggingOut: '登出中...',
    login: '登入',
    loginAttempts: '登入次數',
    loginUser: '登入使用者',
    loginWithAnotherUser: '要使用另一個使用者登入前，您需要先<0>登出</0>。',
    logOut: '登出',
    logout: '登出',
    logoutSuccessful: '成功登出。',
    logoutUser: '登出使用者',
    newAccountCreated:
      '剛剛為您建立了一個可以存取 <a href="{{serverURL}}">{{serverURL}}</a> 的新帳戶。請點擊以下連結或在瀏覽器中貼上以下網址以驗證您的電子郵件：<a href="{{verificationURL}}">{{verificationURL}}</a><br> 驗證您的電子郵件後，您將能夠成功登入。',
    newAPIKeyGenerated: '新的API金鑰已生成。',
    newPassword: '新的密碼',
    passed: '身份驗證通過',
    passwordResetSuccessfully: '成功重設密碼。',
    resetPassword: '重設密碼',
    resetPasswordExpiration: '重設密碼的有效期',
    resetPasswordToken: '重設密碼令牌',
    resetYourPassword: '重設您的密碼',
    stayLoggedIn: '保持登入狀態',
    successfullyRegisteredFirstUser: '成功註冊了第一個使用者。',
    successfullyUnlocked: '已成功解鎖',
    tokenRefreshSuccessful: '令牌刷新成功。',
    unableToVerify: '無法驗證',
    username: '使用者名稱',
    usernameNotValid: '提供的使用者名稱無效',
    verified: '已驗證',
    verifiedSuccessfully: '成功驗證',
    verify: '驗證',
    verifyUser: '驗證使用者',
    verifyYourEmail: '驗證您的電子郵件',
    youAreInactive:
      '您已經有一段時間沒有活動了，為了您的安全，很快就會自動登出。您想保持登入狀態嗎？',
    youAreReceivingResetPassword:
      '您收到此郵件是因為您（或其他人）已請求重設您帳戶的密碼。請點擊以下連結，或將其貼上到您的瀏覽器中以完成該過程：',
    youDidNotRequestPassword: '如果您沒有要求這樣做，請忽略這封郵件，您的密碼將保持不變。',
  },
  error: {
    accountAlreadyActivated: '該帳戶已被啟用。',
    autosaving: '自動儲存該文件時出現了問題。',
    correctInvalidFields: '請更正無效區塊。',
    deletingFile: '刪除文件時出現了錯誤。',
    deletingTitle: '刪除{{title}}時出現了錯誤。請檢查您的網路連線並重試。',
    emailOrPasswordIncorrect: '提供的電子郵件或密碼不正確。',
    followingFieldsInvalid_one: '下面的字串是無效的：',
    followingFieldsInvalid_other: '以下字串是無效的：',
    incorrectCollection: '不正確的集合',
    invalidFileType: '無效的文件類型',
    invalidFileTypeValue: '無效的文件類型： {{value}}',
    loadingDocument: '加載ID為{{id}}的文件時出現了問題。',
    localesNotSaved_one: '以下的地區設定無法保存：',
    localesNotSaved_other: '以下地區無法保存：',
    logoutFailed: '登出失敗。',
    missingEmail: '缺少電子郵件。',
    missingIDOfDocument: '缺少需要更新的文檔的ID。',
    missingIDOfVersion: '缺少版本的ID。',
    missingRequiredData: '缺少必要的數據。',
    noFilesUploaded: '沒有上傳文件。',
    noMatchedField: '找不到與"{{label}}"匹配的字串',
    notAllowedToAccessPage: '您沒有權限訪問此頁面。',
    notAllowedToPerformAction: '您不被允許執行此操作。',
    notFound: '沒有找到請求的資源。',
    noUser: '沒有該使用者',
    previewing: '預覽文件時出現了問題。',
    problemUploadingFile: '上傳文件時出現了問題。',
    tokenInvalidOrExpired: '令牌無效或已過期。',
    tokenNotProvided: '未提供令牌。',
    unableToDeleteCount: '無法從 {{total}} 個中刪除 {{count}} 個 {{label}}。',
    unableToUpdateCount: '無法從 {{total}} 個中更新 {{count}} 個 {{label}}。',
    unauthorized: '未經授權，您必須登錄才能提出這個請求。',
    unknown: '發生了一個未知的錯誤。',
    unPublishingDocument: '取消發布此文件時出現了問題。',
    unspecific: '發生了一個錯誤。',
    userEmailAlreadyRegistered: '給定電子郵件的用戶已經註冊。',
    userLocked: '該使用者由於有太多次失敗的登錄嘗試而被鎖定。',
    usernameAlreadyRegistered: '已有使用者使用所提供的用戶名註冊。',
    usernameOrPasswordIncorrect: '提供的使用者名稱或密碼不正確。',
    valueMustBeUnique: '數值必須是唯一的',
    verificationTokenInvalid: '驗證令牌無效。',
  },
  fields: {
    addLabel: '新增{{label}}',
    addLink: '新增連結',
    addNew: '新增',
    addNewLabel: '新增{{label}}',
    addRelationship: '新增關聯',
    addUpload: '上傳',
    block: '區塊',
    blocks: '區塊',
    blockType: '區塊類型',
    chooseBetweenCustomTextOrDocument: '選擇自定義文件或連結到另一個文件。',
    chooseDocumentToLink: '選擇要連結的文件',
    chooseFromExisting: '從現有的選擇',
    chooseLabel: '選擇{{label}}',
    collapseAll: '全部折疊',
    customURL: '自定義連結',
    editLabelData: '編輯{{label}}資料',
    editLink: '編輯連結',
    editRelationship: '編輯關聯',
    enterURL: '輸入連結',
    internalLink: '內部連結',
    itemsAndMore: '{{items}} 個，還有 {{count}} 個',
    labelRelationship: '{{label}}關聯',
    latitude: '緯度',
    linkedTo: '連結到<0>{{label}}</0>',
    linkType: '連結類型',
    longitude: '經度',
    newLabel: '新的{{label}}',
    openInNewTab: '在新標籤中打開',
    passwordsDoNotMatch: '密碼不匹配。',
    relatedDocument: '相關文件',
    relationTo: '關聯到',
    removeRelationship: '移除關聯',
    removeUpload: '移除上傳',
    saveChanges: '儲存變更',
    searchForBlock: '搜尋一個區塊',
    selectExistingLabel: '選擇現有的{{label}}',
    selectFieldsToEdit: '選擇要編輯的字串',
    showAll: '顯示全部',
    swapRelationship: '替換關聯',
    swapUpload: '替換上傳',
    textToDisplay: '要顯示的文字',
    toggleBlock: '切換區塊',
    uploadNewLabel: '上傳新的{{label}}',
  },
  general: {
    aboutToDelete: '您即將刪除{{label}} <1>{{title}}</1>。您確定要繼續嗎？',
    aboutToDeleteCount_many: '您即將刪除 {{count}} 個 {{label}}',
    aboutToDeleteCount_one: '您即將刪除 {{count}} 個 {{label}}',
    aboutToDeleteCount_other: '您即將刪除 {{count}} 個 {{label}}',
    addBelow: '新增到下方',
    addFilter: '新增過濾器',
    adminTheme: '管理頁面主題',
    and: '和',
    anotherUserTakenOver: '另一位使用者接管了此文件的編輯。',
    applyChanges: '套用更改',
    ascending: '升冪',
    automatic: '自動',
    backToDashboard: '返回到控制面板',
    cancel: '取消',
    changesNotSaved: '您還有尚未儲存的變更。您確定要離開嗎？',
    clearAll: '清除全部',
    close: '關閉',
    collapse: '折疊',
    collections: '集合',
    columns: '欄位',
    columnToSort: '要排序的欄位',
    confirm: '確認',
    confirmDeletion: '確認刪除',
    confirmDuplication: '確認複製',
    copied: '已複製',
    copy: '複製',
    create: '建立',
    created: '已建立',
    createdAt: '建立於',
    createNew: '建立新的',
    createNewLabel: '建立新的{{label}}',
    creating: '建立中',
    creatingNewLabel: '正在建立新的{{label}}',
    currentlyEditing:
      '目前正在編輯此文件。如果您接管，他們將無法繼續編輯，並且可能會丟失未保存的更改。',
    custom: '自訂',
    dark: '深色',
    dashboard: '控制面板',
    delete: '刪除',
    deletedCountSuccessfully: '已成功刪除 {{count}} 個 {{label}}。',
    deletedSuccessfully: '已成功刪除。',
    deleting: '刪除中...',
    depth: '深度',
    descending: '降冪',
    deselectAllRows: '取消選擇全部',
    document: '文件',
    documentLocked: '文件已鎖定',
    documents: '文件',
    duplicate: '複製',
    duplicateWithoutSaving: '複製而不儲存變更。',
    edit: '編輯',
    editedSince: '自...以來編輯',
    editing: '編輯中',
    editingLabel_many: '編輯 {{count}} 個 {{label}}',
    editingLabel_one: '編輯 {{count}} 個 {{label}}',
    editingLabel_other: '編輯 {{count}} 個 {{label}}',
    editingTakenOver: '編輯已被接管',
    editLabel: '編輯{{label}}',
    email: '電子郵件',
    emailAddress: '電子郵件地址',
    enterAValue: '輸入一個值',
    error: '錯誤',
    errors: '錯誤',
    fallbackToDefaultLocale: '回到預設的語言',
    false: '假的',
    filter: '過濾器',
    filters: '過濾器',
    filterWhere: '過濾{{label}}',
    globals: '全域',
    goBack: '返回',
    isEditing: '正在編輯',
    language: '語言',
    lastModified: '最後修改',
    leaveAnyway: '無論如何都要離開',
    leaveWithoutSaving: '不儲存直接離開',
    light: '亮色',
    livePreview: '預覽',
    loading: '載入中...',
    locale: '語言環境',
    locales: '語言環境',
    menu: '菜單',
    moveDown: '向下移動',
    moveUp: '向上移動',
    newPassword: '新密碼',
    next: '下一個',
    noFiltersSet: '沒有設定過濾器',
    noLabel: '<沒有{{label}}>',
    none: '無',
    noOptions: '沒有選項',
    noResults: '沒有找到{{label}}。{{label}}並不存在或沒有符合您上面所指定的過濾器。',
    notFound: '未找到',
    nothingFound: '沒有找到任何東西',
    noValue: '沒有數值',
    of: '的',
    only: '僅限',
    open: '打開',
    or: '或',
    order: '排序',
    pageNotFound: '未找到頁面',
    password: '密碼',
    payloadSettings: 'Payload設定',
    perPage: '每一頁： {{limit}} 個',
    previous: '先前的',
    remove: '移除',
    reset: '重設',
    row: '行',
    rows: '行',
    save: '儲存',
    saving: '儲存中...',
    searchBy: '搜尋{{label}}',
    selectAll: '選擇所有 {{count}} 個 {{label}}',
    selectAllRows: '選擇所有行',
    selectedCount: '已選擇 {{count}} 個 {{label}}',
    selectValue: '選擇一個值',
    showAllLabel: '顯示所有{{label}}',
    sorryNotFound: '對不起，沒有找到您請求的東西。',
    sort: '排序',
    sortByLabelDirection: '按{{label}} {{direction}}排序',
    stayOnThisPage: '停留在此頁面',
    submissionSuccessful: '成功送出。',
    submit: '送出',
    submitting: '提交中...',
    success: '成功',
    successfullyCreated: '成功建立{{label}}',
    successfullyDuplicated: '成功複製{{label}}',
    takeOver: '接管',
    thisLanguage: '中文 (繁體)',
    titleDeleted: '{{label}} "{{title}}"已被成功刪除。',
    true: '真實',
    unauthorized: '未經授權',
    unsavedChangesDuplicate: '您有還沒儲存的修改，確定要繼續複製嗎？',
    untitled: '無標題',
    updatedAt: '更新於',
    updatedCountSuccessfully: '已成功更新 {{count}} 個 {{label}}。',
    updatedSuccessfully: '更新成功。',
    updating: '更新中',
    uploading: '上傳中',
    user: '使用者',
    username: '使用者名稱',
    users: '使用者',
    value: '值',
    viewReadOnly: '僅檢視',
    welcome: '歡迎',
  },
  operators: {
    contains: '包含',
    equals: '等於',
    exists: '存在',
    intersects: '交叉點',
    isGreaterThan: '大於',
    isGreaterThanOrEqualTo: '大於等於',
    isIn: '在',
    isLessThan: '小於',
    isLessThanOrEqualTo: '小於或等於',
    isLike: '就像',
    isNotEqualTo: '不等於',
    isNotIn: '不在',
    near: '附近',
    within: '在...之內',
  },
  upload: {
    addFile: '添加文件',
    addFiles: '添加檔案',
    bulkUpload: '批量上傳',
    crop: '裁剪',
    cropToolDescription: '拖動所選區域的角落，繪製一個新區域或調整以下的值。',
    dragAndDrop: '拖放一個檔案',
    dragAndDropHere: '或在這裡拖放一個檔案',
    editImage: '編輯圖像',
    fileName: '檔案名稱',
    fileSize: '檔案大小',
    filesToUpload: '上傳的文件',
    fileToUpload: '上傳檔案',
    focalPoint: '焦點',
    focalPointDescription: '直接在預覽中拖動焦點或調整下面的值。',
    height: '高度',
    lessInfo: '更少資訊',
    moreInfo: '更多資訊',
    pasteURL: '貼上網址',
    previewSizes: '預覽尺寸',
    selectCollectionToBrowse: '選擇一個要瀏覽的集合',
    selectFile: '選擇一個文件',
    setCropArea: '設置裁剪區域',
    setFocalPoint: '設置焦點',
    sizes: '尺寸',
    sizesFor: '{{label}}的尺寸',
    width: '寬度',
  },
  validation: {
    emailAddress: '請輸入一個有效的電子郵件地址。',
    enterNumber: '請輸入一個有效的數字。',
    fieldHasNo: '這個字串沒有{{label}}',
    greaterThanMax: '{{value}}超過了允許的最大{{label}}，該最大值為{{max}}。',
    invalidInput: '這個字串有一個無效的輸入。',
    invalidSelection: '這個字串有一個無效的選擇。',
    invalidSelections: '這個字串有以下無效的選擇：',
    lessThanMin: '{{value}}小於允許的最小{{label}}，該最小值為{{min}}。',
    limitReached: '已達限制，只能添加{{max}}個項目。',
    longerThanMin: '該值必須大於{{minLength}}字串的最小長度',
    notValidDate: '"{{value}}"不是一個有效的日期。',
    required: '該字串為必填項目。',
    requiresAtLeast: '該字串至少需要 {{count}} 個 {{label}}。',
    requiresNoMoreThan: '該字串要求不超過 {{count}} 個 {{label}。',
    requiresTwoNumbers: '該字串需要兩個數字。',
    shorterThanMax: '該值長度必須小於{{maxLength}}個字元',
    trueOrFalse: '該字串只能等於是或否。',
    username: '請輸入有效的使用者名稱。可以包含字母、數字、連字號、句點和底線。',
    validUploadID: '該字串不是有效的上傳ID。',
  },
  version: {
    type: '類型',
    aboutToPublishSelection: '您確定即將發佈所選的 {{label}} 嗎？',
    aboutToRestore: '您將把這個文件{{label}}回復到{{versionDate}}時的狀態',
    aboutToRestoreGlobal: '您要將痊域的{{label}}回復到{{versionDate}}時的狀態',
    aboutToRevertToPublished: '您將要將這個文件的內容還原到它的發佈狀態。您確定嗎？',
    aboutToUnpublish: '您即將取消發佈這個文件。您確定嗎？',
    aboutToUnpublishSelection: '您即將取消發佈所選內容中的所有 {{label}}。您確定嗎？',
    autosave: '自動儲存',
    autosavedSuccessfully: '自動儲存成功。',
    autosavedVersion: '自動儲存的版本',
    changed: '已更改',
    compareVersion: '對比版本：',
    confirmPublish: '確認發佈',
    confirmRevertToSaved: '確認回復到儲存狀態',
    confirmUnpublish: '確認取消發佈',
    confirmVersionRestoration: '確認版本回復',
    currentDocumentStatus: '目前{{docStatus}}文件',
    currentDraft: '目前的草稿',
    currentPublishedVersion: '目前已發布的版本',
    draft: '草稿',
    draftSavedSuccessfully: '草稿儲存成功。',
    lastSavedAgo: '上次儲存在{{distance}}之前',
    modifiedOnly: undefined,
    noFurtherVersionsFound: '沒有發現其他版本',
    noRowsFound: '沒有發現{{label}}',
    noRowsSelected: '未選擇 {{label}}',
    preview: '預覽',
    previouslyPublished: '先前出版過的',
    problemRestoringVersion: '回復這個版本時發生了問題',
    publish: '發佈',
    publishChanges: '發佈修改',
    published: '已發佈',
    publishIn: '在 {{locale}} 發佈',
    publishing: '發布',
    restoreAsDraft: '恢復為草稿',
    restoredSuccessfully: '回復成功。',
    restoreThisVersion: '回復此版本',
    restoring: '回復中...',
    reverting: '還原中...',
    revertToPublished: '還原到已發佈的版本',
    saveDraft: '儲存草稿',
    selectLocales: '選擇要顯示的語言',
    selectVersionToCompare: '選擇要比較的版本',
    showingVersionsFor: '顯示版本為：',
    showLocales: '顯示語言：',
    status: '狀態',
    unpublish: '取消發佈',
    unpublishing: '取消發佈中...',
    version: '版本',
    versionCount_many: '發現 {{count}}個版本',
    versionCount_none: '沒有發現任何版本',
    versionCount_one: '找到 {{count}} 個版本',
    versionCount_other: '找到 {{count}} 個版本',
    versionCreatedOn: '版本 {{version}} 建立於：',
    versionID: '版本ID',
    versions: '版本',
    viewingVersion: '正在查看{{entityLabel}} {{documentTitle}}的版本',
    viewingVersionGlobal: '正在查看全域{{entityLabel}}的版本',
    viewingVersions: '正在查看{{entityLabel}} {{documentTitle}}的版本',
    viewingVersionsGlobal: '正在查看全域{{entityLabel}}的版本',
  },
}

export const zhTw: Language = {
  dateFNSKey: 'zh-TW',
  translations: zhTwTranslations,
}
