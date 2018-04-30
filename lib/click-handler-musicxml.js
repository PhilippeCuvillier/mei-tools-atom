'use babel';

import $ from 'jquery';

//TODO: explicit the public interface of ClickHandler
// - handleClickOnNotation
// - getIdOfItemAtCursor
// - loadData

/**
 * Handle click interaction between Verovio graphic SVG and text buffer, when input text is a MusicXML markup.
 * Deals with partwise MusicXML markup. Deals with events that do not have IDs.
 * 
 * @class ClickHandlerMusicXml
 */
class ClickHandlerMusicXml {
    constructor() {
      this.meiDoc = null;
      this.xmlDoc = null;
      this.part2staff = null;
    }
    
    /**
     * Should be called whenever a MusicXML score is loaded and/or whenever a score is rendered.
     * 
     * @param {String} xmlString
     * @param {String} meiString
     * @memberof ClickHandlerMusicXml
     */
    loadData(xmlString, meiString) {
      this.meiDoc = new DOMParser().parseFromString(meiString, 'text/xml');
      this.xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
      this.part2staff = this.getPartsFromMusicXml(this.xmlDoc)
    }
  
    /**
     * Build a map that associates each MusicXML <part> element to their number of music staves
     * 
     * @param {any} xmlDoc 
     * @returns {Map} 
     * @memberof ClickHandlerMusicXml
     */
    getPartsFromMusicXml(xmlDoc) {
      let part2staff = new Map();
      let iterator = xmlDoc.evaluate(
        `score-partwise/part`
      , xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  
      var staffNode = iterator.iterateNext();
      var staffPosition = 0;
      var staffNumber = null;
      while (staffNode) {
        staffNumber = xmlDoc.evaluate(
          `.//staff[not((ancestor::part|parent::*)//staff/text() > text())]/text()`
        , staffNode, null, XPathResult.NUMBER_TYPE, null).numberValue
        staffPosition += (isNaN(staffNumber) ? 1 : Math.max(staffNumber, 1));
        part2staff.set(staffNode, staffPosition)
  
        staffNode = iterator.iterateNext();
      }	
  
      return part2staff;
    }
  
    /**
     * Returns the 'id' of the Verovio <measure> that corresponds to the MusicXML <measure> with given 'number' attribute
     * 
     * @param {number} number measure number
     * @returns {String} measure ID
     * @memberof ClickHandlerMusicXml
     */
    getMeasureIdForMeasureXmlNumber(number) {
      let meiDoc = this.meiDoc;
      let measureMei = meiDoc.evaluate(`//*[local-name()="measure"][@n=${number}]`, meiDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (!measureMei) {
        return null;
      }
      return measureMei.getAttribute("xml:id");
    }
  
    /**
     * Return 'id' attribute of 'part' MusicXML element which contains the corresponding 'staff' MEI element at given position
     * 
     * @param {number} position   staff position (starting from 1)
     * @returns {HTMLElement}    'part' element 
     * @memberof ClickHandlerMusicXml
     */
    getXmlPartElementForStaffPosition(position) {
      let part2staff = this.part2staff;
  
      if (!part2staff) {
        return null;
      }
  
      // look for the part that contains the given staff
      for (let [staff, maxPosition] of part2staff.entries()) {
        if (position <= maxPosition) {
          return staff;
        }
      }
      // If not found, then simply return the first part
      return part2staff.keys().next().value;
    }
  
  
    /**
     * Get the MusicXML element associated to a given graphical score element.
     * Current implementation looks for the <measure> element in the right <part> element.
     * 
     * @param {HTMLElement} element graphical score element
     * @returns 
     * @memberof ClickHandlerMusicXml
     */
    getMeasureContainingElement(element) {
      // Retrieve position of parent 'g.measure' graphical element
      // 1/2: Retrieve ID of parent 'g.measure' graphical element
      let measureVerovio = element.closest('g.measure')
      if (!measureVerovio) {
        return null;
      }
      
      let measureId = measureVerovio.id;
      if (!measureId) {
        return null;
      }
  
      // 2/2: Retrieve position of 'measure' MEI element with same ID
      let measureMeiPosition = this.meiDoc.evaluate(`count(//*[local-name()="measure"][@*[local-name()="id"]="${measureId}"]/preceding::*[local-name()="measure"])`, this.meiDoc, null, XPathResult.NUMBER_TYPE, null ).numberValue + 1;
      if (!measureMeiPosition) {
        return null;
      }
  
      // Try to retrieve corresponding 'part' MusicXML element of parent 'staff' graphical element
      let partNode;
      let staffVerovio = element.closest('g.staff')
      if (staffVerovio) {          
        var staffPosition = 1;
        var child = staffVerovio;
        while ( (child = child.previousElementSibling) != null ) {
          if (child.matches('g.staff')) {
            staffPosition++;
          }
        }
  
        partNode = this.getXmlPartElementForStaffPosition(staffPosition);
      }
          
      // Look for the measure with same number, in the right 'part' (or in the first part by default)
      let xmlDoc = this.xmlDoc;
      let measureXml;
      if (!partNode) {
        console.warn("no MusicXML part was found for score element", element)
        measureXml = xmlDoc.evaluate(`//measure[position()=${measureMeiPosition}]`, xmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      else {
        measureXml = xmlDoc.evaluate(`measure[position()=${measureMeiPosition}]`, partNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      return measureXml;
    }

    // MEI VERSION
    getRangeOfMeiElement(element, buffer) {
      let e = element;

      // Translate XML element as regex
      let attributeName = "number"
      let ex = `(?:<${partElement.tagName}\\s+id\\s*=\\s*\\D${partElement.getAttribute("id")}\\D)[\\s\\S]+(<${e.tagName}\\s+${attributeName}\\s*=\\s*\\D${e.getAttribute(attributeName)}\\D)`
      let re = new RegExp(ex);
  
      // Locate regex in buffer
      var range = null;
      buffer.scan(re, (obj) => {
        range = obj.range;
        obj.stop();
      });

      return range;
    }


    /**
     * Retrieves range of a MusicXML element in given text buffer.
     * 
     * @param {Element} measure <measure> element 
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
  

    /**
     * Retrieves range of a <measure> MusicXML element in given text buffer.
     * 
     * @param {Element} measureElement <measure> element 
     * @param {Buffer} buffer text buffer
     * @returns {Range} range of element in text buffer
     * @memberof ClickHandlerMusicXml
     */
    getRangeOfMeasureElement(measureElement, buffer) {
      let partElement = measureElement.parentElement;
      let partRange = this.getRangeStartingAtPart(partElement, buffer);
      var range = this.getRangeOfMeasureWithinRange(measureElement, buffer, partRange);

      return range;
    }


    /**
     * Return range of given <measure> element
     * 
     * Ex: for <measure number="10">[...], range starts at <measure and ends at "10"
     * 
     * @param {Element} e       <measure> element
     * @param {TextBuffer} buffer   text buffer to search
     * @param {Range} parentRange   parent range where to search element
     */
    getRangeOfMeasureWithinRange(e, buffer, parentRange = null) {
      // Translate XML element as regex
      let attributeName = "number"
      let ex = `(?:<\\s*${e.tagName}\\s+${attributeName}\\s*=\\s*\\D${e.getAttribute(attributeName)}\\D)`
      let re = new RegExp(ex);
  
      // Locate regex in buffer
      let range;
      if (!parentRange) {
        buffer.scan(re, (obj) => {
          range = obj.range;
          obj.stop();
        });
      }
      else {
        buffer.scanInRange(re, parentRange, (obj) => {
          range = obj.range;
          obj.stop();
        });
      }
  
      return range;
    }
  
  
    /**
     * Return range starting at given <part> element a and ending at the end of the buffer.
     * 
     * @param {HTMLElement} e       <part> element 
     * @param {TextBuffer} buffer   text buffer
     */
    getRangeStartingAtPart(e, buffer) {
      // Translate XML element as regex
      let attributeName = "id"
      let ex = `(?:<\\s*${e.tagName}\\s+${attributeName}\\s*=\\s*\\D${e.getAttribute(attributeName)}\\D)`
      let re = new RegExp(ex);
  
      let range;
      buffer.scan(re, (obj) => {
        range = obj.range;
        obj.stop();
      });
  
      if (range) {
        range.end = buffer.getEndPosition()
      }
  
      return range;
    }
  

    /**
     * Set cursor of text buffer on given element
     * 
     * @param {HTMLElement} element graphical score element 
     * @param {TextEditor} textEditor text editor containing MusicXML markup
     * @memberof ClickHandlerMusicXml
     */
    // setCursorBufferOnXmlElement(element, textEditor) {
    //   // retrieve cursor position in buffer associated to element
    //   let buffer = textEditor.getBuffer();
    //   let range = this.getRangeOfElement(element, buffer);
  
    //   // set cursor position in buffer
    //   if (range) {
    //     textEditor.setCursorBufferPosition([range.start.row, range.start.column]);
    //   }
    // }
  
    /**
     * Triggered when a score element is clicked on.
     * 
     * @param {HTMLElement} e graphic score element that is clicked on
     * @param {TextEditor} textEditor text editor containing MusicXML markup
     * @memberof ClickHandlerMusicXml
     */
    // handleClickOnNotation(e, textEditor) {
    //   this.setCursorBufferOnXmlElement(e, textEditor);
    // }


  /**
   * Returns the ID in the graphical SVG score of the element at given cursor position in given text
   * 
   * @param {string} text 
   * @param {Point} cursorPosition
   * @returns {string} ID
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


    // //// MEI
    // // if no id is found, look in parent staff and measure to find one
    // let outsideParentStaff = false;

    // for (let m = row; m >= 0; m--) {
    //   line = text.lineForRow(m);

    //   if (line.includes('<music')) {
    //     break;
    //   }

    //   if (line.includes('</staff')) {
    //     outsideParentStaff = true;
    //     continue;
    //   }

    //   if (line.includes('<measure') || (line.includes('<staff') && !outsideParentStaff)) {

    //     result = line.match(XMLidRe);
    //     if (result !== null) {
    //       return result[1];
    //     }

    //     // if this line is parent <measure>, stop looking
    //     if (line.includes('<measure')) {
    //       break;
    //     }
    //   }
    // }
    // //// /MEI

    //// MusicXML (partwise)
    const XMLnumberRe = /(?:number=)(?:['"])(\d+?)(?:['"])/;

    for (let m = row; m >= 0; m--) {
      line = text.lineForRow(m);

      // break if outside part
      if (line.includes('<part')) {
        break;
      }

      if (line.includes('<measure ')) {
        // look for @number attribute of <measure> XML element and matches it inside Verovio graphics MEI
        result = line.match(XMLnumberRe);
        if (result !== null) {
          let number = result[1];
          if (number !== null) {
            let id = this.getMeasureIdForMeasureXmlNumber(number);
            if (id !== null) {
              return id;
            }
          }
        }
      }
    }
    //// /MusicXML

    // if no xml:id is found, return null
    return null;
  }
}


  module.exports = ClickHandlerMusicXml