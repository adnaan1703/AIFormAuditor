function extractFormLogic() {
  var form = FormApp.getActiveForm();
  var items = form.getItems();
  var result = [];

  var sectionMap = {};
  var currentSectionTitle = 'Start';
  var sectionIndex = 0;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var itemType = item.getType();
    var obj = {
      index: i + 1,
      id: item.getId().toString(),
      type: itemType.toString(),
      title: item.getTitle(),
      helpText: item.getHelpText() || '',
      section: sectionIndex + ': ' + currentSectionTitle
    };

    var isSectionBreak = false;

    switch (itemType) {
      case FormApp.ItemType.MULTIPLE_CHOICE:
        var mcItem = item.asMultipleChoiceItem();
        var mcChoices = mcItem.getChoices();
        obj.choices = mcChoices.map(function(choice) {
          return buildChoiceEntry(choice);
        });
        if (mcItem.hasOtherOption()) {
          obj.hasOtherOption = true;
        }
        break;

      case FormApp.ItemType.CHECKBOX:
        var cbItem = item.asCheckboxItem();
        var cbChoices = cbItem.getChoices();
        obj.choices = cbChoices.map(function(choice) {
          return { text: choice.getValue(), navigation: 'CONTINUE' };
        });
        if (cbItem.hasOtherOption()) {
          obj.hasOtherOption = true;
        }
        break;

      case FormApp.ItemType.LIST:
        var listItem = item.asListItem();
        var listChoices = listItem.getChoices();
        obj.choices = listChoices.map(function(choice) {
          return buildChoiceEntry(choice);
        });
        break;

      case FormApp.ItemType.PAGE_BREAK:
        var pbItem = item.asPageBreakItem();
        var pbNavigation = pbItem.getPageNavigationType();
        if (pbNavigation === FormApp.PageNavigationType.GO_TO_PAGE) {
          var gotoPage = pbItem.getGotoPage();
          if (gotoPage) {
            obj.goToSection = gotoPage.getTitle();
          }
        } else if (pbNavigation === FormApp.PageNavigationType.SUBMIT) {
          obj.goToSubmit = true;
        } else if (pbNavigation === FormApp.PageNavigationType.RESTART) {
          obj.goToRestart = true;
        }
        isSectionBreak = true;
        break;

      case FormApp.ItemType.SECTION_HEADER:
        currentSectionTitle = item.getTitle();
        sectionIndex++;
        isSectionBreak = true;
        break;

      case FormApp.ItemType.PARAGRAPH_TEXT:
        break;

      case FormApp.ItemType.TEXT:
        break;

      case FormApp.ItemType.SCALE:
        var scaleItem = item.asScaleItem();
        obj.lowerBound = scaleItem.getLowerBound();
        obj.upperBound = scaleItem.getUpperBound();
        obj.leftLabel = scaleItem.getLeftLabel();
        obj.rightLabel = scaleItem.getRightLabel();
        break;

      case FormApp.ItemType.GRID:
        var gridItem = item.asGridItem();
        obj.rows = gridItem.getRows();
        obj.columns = gridItem.getColumns();
        break;

      case FormApp.ItemType.DATE:
        break;

      case FormApp.ItemType.TIME:
        break;

      case FormApp.ItemType.DURATION:
        break;

      case FormApp.ItemType.IMAGE:
        break;

      case FormApp.ItemType.VIDEO:
        break;

      default:
        break;
    }

    if (isSectionBreak) {
      sectionMap[obj.title] = sectionIndex;
    }

    result.push(obj);
  }

  result.push({
    summary: {
      totalItems: items.length,
      totalSections: sectionIndex,
      sectionMap: sectionMap
    }
  });

  return result;
}

function buildChoiceEntry(choice) {
  var nav = choice.getPageNavigationType();
  var navLabel = 'CONTINUE';

  if (nav === FormApp.PageNavigationType.GO_TO_PAGE) {
    var gotoPage = choice.getGotoPage();
    if (gotoPage) {
      navLabel = 'GO_TO_SECTION_' + gotoPage.getTitle();
    } else {
      navLabel = 'SUBMIT';
    }
  } else if (nav === FormApp.PageNavigationType.SUBMIT) {
    navLabel = 'SUBMIT';
  } else if (nav === FormApp.PageNavigationType.RESTART) {
    navLabel = 'RESTART';
  }

  return {
    text: choice.getValue(),
    navigation: navLabel
  };
}