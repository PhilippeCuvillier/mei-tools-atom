'use babel';

import $ from 'jquery';

//TODO: finish this class implementation
// - getRangeOfElement
// - getIdOfItemAtCursor
// - loadData


/**
 * Handle click interaction between Verovio graphic SVG and text buffer, when input text is a MEI markup.
 * Deals with MEI markup whose element contains ID attributes.
 * 
 * @class ClickHandlerMei
 */
class ClickHandlerMei {
  constructor() {
    
  }

  /**
  * Should be called whenever a score is loaded, modified and/or rendered.
  * 
  * @param {String} scoreString  raw score coming from text editor
  * @param {String} meiString  MEI score coming from Verovio graphic rendering
  * @memberof ClickHandlerMusicXml
  */
  loadData(scoreString, meiString) {
    // Nothing to do
  }

  /**
   * Returns the ID in the graphical SVG score of the element at given cursor position in given text
   * 
   * @param {TextBuffer} text text buffer containg MusicXML score
   * @param {Point} cursorPosition  current position of cursor inside text buffer
   * @returns {string} ID attribute of graphic score element
   */
  getIdOfItemAtCursor(text, cursorPosition) {
    let result;
    let tag;
    let row = cursorPosition.row;
    let column = cursorPosition.column;
    const closingTagRe = /(?:<[/])(\S+?)(?:[>])/;
    const XMLidRe = /(?:xml:id=)(?:['"])(\S+?)(?:['"])/;

    // get line from current cursor position
    let line = text.lineForRow(row);

    // check if cursor is on a closing tag by stepping backwards through the characters
    for (let j = column; j > 0; j--) {
      if (line[j] === "/" && line[j - 1] === "<") {
        // if closing tag is found, find the name of the tag with regex
        tag = line.slice(j - 1).match(closingTagRe);
        if (tag && Array.isArray(tag)) {
          tag = tag[1];
          break;
        }
      }
    }

    // if closing tag identified, find opening tag and set row number accordingly
    if (tag) {
      for (let k = row - 1; k >= 0; k--) {
        if (text.lineForRow(k).includes(`<${tag}`)) {
          row = k;
          break;
        }
      }
    }

    // search for xml:id in row
    result = text.lineForRow(row).match(XMLidRe);

    // if one is found, return it
    if (result !== null) {
      return result[1];
    }


    //// MEI
    // if no id is found, look in parent staff and measure to find one
    let outsideParentStaff = false;

    for (let m = row; m >= 0; m--) {
      line = text.lineForRow(m);

      if (line.includes('<music')) {
        break;
      }

      if (line.includes('</staff')) {
        outsideParentStaff = true;
        continue;
      }

      if (line.includes('<measure') || (line.includes('<staff') && !outsideParentStaff)) {

        result = line.match(XMLidRe);
        if (result !== null) {
          return result[1];
        }

        // if this line is parent <measure>, stop looking
        if (line.includes('<measure')) {
          break;
        }
      }
    }
    //// /MEI

    // if no xml:id is found, return null
    return null;
  }


  /**
   * Retrieves range of a XML score element in given text buffer.
   * 
   * @param {Element} measure XML element 
   * @param {Buffer} buffer text buffer
   * @returns {Range} range of element in text buffer
   * @memberof ClickHandlerMusicXml
   */
  getRangeOfElement(element, buffer) {
    // Retrieve <measure> MusicXML element associated to given graphical element.
    let measureElement = this.getMeasureContainingElement(element);
    if (measureElement) {
      return this.getRangeOfMeasureElement(measureElement, buffer);
    }

    // Retrieve range in text buffer of <measure> element  
  }
}


module.exports = ClickHandlerMei