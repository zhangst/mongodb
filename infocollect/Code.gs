function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ui.createMenu('MongoTool').addItem('Analyse MongoDB JSON', 'showPicker').addToUi();
  const requiredSheets = ["MongoDB", "Collections", "Indexes", "Search Indexes"];
  requiredSheets.forEach(sheetName => {
    if (!spreadsheet.getSheetByName(sheetName)) {
      spreadsheet.insertSheet(sheetName);
    }
  });
}

function showPicker() {
  var html = HtmlService.createHtmlOutputFromFile('UploadDialog.html').setWidth(600).setHeight(425);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select MongoDB JSON File');
}

function addResults(results) {
   generalInfo(results);
   collectionSheet(results); 
   indexSheet(results);
   searchIndexSheet(results);
}

function generalInfo(results) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MongoDB");
  sheet.clear(); 
  
  const generalData = [
    ["MongoDB Version", results.mongodb.version], ["Storage Engine", results.mongodb.storageEngine],
    ["Modules", results.mongodb.modules], ["Total DB Size (GB)", results.mongodb.totalSize / (1024*1024*1024)],
    ["Total Storage Size (GB)", results.mongodb.totalStorageSize / (1024*1024*1024)],
    ["Total Index Size (GB)", results.mongodb.totalIndexSize / (1024*1024*1024)],
    ["Command Line", JSON.stringify(results.mongodb.cmdLine, null, 2)]
  ];  
  sheet.getRange(1, 1, generalData.length, 2).setValues(generalData);
  sheet.getRange(7, 2).setWrap(true);

  if (results.mongodb.storageEngine !== 'wiredTiger') {
      sheet.getRange(2, 2).setBackground("red").setFontColor("white").setFontWeight("bold");
  }

  const summary = results.limitationsSummary;
  const summaryHeader = [["MongoSync Limitation Summary", "Detected?"]];
  
  // ***** ADD: "Balancer Running" check to the summary table *****
  const summaryData = [
    ["Balancer Running", summary.isBalancerRunning ? "Yes" : "No"],
    ["Timeseries Collections", summary.hasTimeseries ? "Yes" : "No"],
    ["Non-WiredTiger Engine", summary.isNotWiredTiger ? "Yes" : "No"],
    ["Sharding Zones Configured", summary.hasZones ? "Yes" : "No"],
    ["Queryable Encryption Used", summary.hasQueryableEncryption ? "Yes" : "No"],
    ["Clustered Coll. with TTL", summary.hasClusteredWithTTL ? "Yes" : "No"],
    ["Duplicate Key Indexes", summary.hasDuplicateKeyConflict ? "Yes" : "No"],
    ["Atlas Search Indexes", summary.hasAtlasSearchIndex ? "Yes" : "No"],
    ["Views Present", summary.hasView ? "Yes" : "No"],
    ["DB/Coll Name with '.'", summary.hasDotInName ? "Yes" : "No"]
  ];
  
  const startRow = generalData.length + 2;
  sheet.getRange(startRow, 1, 1, 2).setValues(summaryHeader).setFontWeight("bold");
  sheet.getRange(startRow + 1, 1, summaryData.length, 2).setValues(summaryData).setHorizontalAlignment("left");
  
  // 现有的高亮逻辑会自动处理新增的行
  for (let i = 0; i < summaryData.length; i++) {
    const cell = sheet.getRange(startRow + 1 + i, 2);
    if (summaryData[i][1] === "Yes") {
      cell.setBackground("red").setFontColor("white").setFontWeight("bold");
    } else {
      cell.setBackground("#d9ead3").setFontColor("black").setFontWeight("normal");
    }
  }
  
  sheet.autoResizeColumns(1, 2); 
}

function collectionSheet(results) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Collections");
  sheet.clear();
  if(results.collections.length === 0) { sheet.appendRow(["No collections found."]); return; }

  const header = [
      "Namespace", "Count", "Data Size (MB)", "Storage Size (MB)",
      "Type", "Is Sharded", "Timeseries", "Clustered", "Capped", "View", 
      "Queryable Encryption", "Clustered with TTL", "Has Atlas Search Index", "Has '.' in Name"
  ];
  sheet.appendRow(header);
  sheet.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#d9ead3");

  const rows = results.collections.map(c => [
     c.ns, c.count, c.size / (1024*1024), c.storageSize / (1024*1024),
     c.type, c.isSharded ? "Yes" : "No", c.isTimeseries ? "Yes" : "No", 
     c.isClustered ? "Yes" : "No", c.isCapped ? "Yes" : "No", c.isView ? "Yes" : "No",
     c.hasQueryableEncryption ? "Yes" : "No", c.isClusteredWithTTL ? "Yes" : "No",
     c.hasAtlasSearchIndex ? "Yes" : "No", c.hasDotInName ? "Yes" : "No"
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
    
    const rules = sheet.getConditionalFormatRules();
    const limitationColumns = [7, 8, 9, 10, 11, 12, 13, 14]; 
    limitationColumns.forEach(col => {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("Yes").setBackground("red").setFontColor("white")
          .setRanges([sheet.getRange(2, col, rows.length, 1)]).build());
    });
    sheet.setConditionalFormatRules(rules);
  }

  sheet.autoResizeColumns(1, header.length);
  sheet.setFrozenRows(1);
}

function indexSheet(results) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Indexes");
  sheet.clear(); 
  if(results.indexes.length === 0) { sheet.appendRow(["No indexes found."]); return; }
  
  const header = [
    "Namespace", "Index Name", "Size (MB)", "Accesses (Ops)",
    "Unique", "TTL", "Duplicate Key Conflict", "Empty Sort Field",
    "Key Definition", "Full Definition" 
  ];
  sheet.appendRow(header);
  sheet.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#d9ead3");

  const rows = results.indexes.map(idx => [
     idx.ns, idx.name, idx.size / (1024 * 1024), idx.accesses,
     idx.unique ? "Yes" : "No", idx.isTTL ? "Yes" : "No",
     idx.hasDuplicateKeyConflict ? "Yes" : "No", idx.hasEmptySort ? "Yes" : "No",
     idx.key, idx.fullDefinition
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);

    const rules = sheet.getConditionalFormatRules();
    const yesColumns = [5, 6, 7, 8];
    yesColumns.forEach(col => {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo("Yes").setBackground("red").setFontColor("white")
          .setRanges([sheet.getRange(2, col, rows.length, 1)]).build());
    });
    sheet.setConditionalFormatRules(rules);
  }
  
  sheet.autoResizeColumns(1, header.length);
  sheet.setFrozenRows(1);
}

function searchIndexSheet(results) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Search Indexes");
    sheet.clear();
    if (!results.searchIndexes || results.searchIndexes.length === 0) {
        sheet.appendRow(["No Atlas Search indexes found."]);
        return;
    }
    const header = ["Namespace", "Index Name", "Definition"];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#d9ead3");
    const rows = results.searchIndexes.map(s_idx => [s_idx.ns, s_idx.name, s_idx.definition]);
    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, header.length).setValues(rows).setWrap(true);
    }
    sheet.autoResizeColumns(1, header.length);
    sheet.setFrozenRows(1);
}