#!/usr/bin/env node

const DMP = require('diff-match-patch')
const dmp = new DMP.diff_match_patch()

const micropatch = {
  //  REPLACE [at, length, insertion, at...]
  //  DELETE  [at, length, at...]
  //  INSERT  [at, insertion, at...]
  //
  //    — Next is string?      — Next is string?      — Next is string?
  //                — Nope                 — Nope                  — Yep
  //    — Then is string?      — Then is string?      — INSERT!
  //                 — Yep                  — Yep
  //    — REPLACE!              — DELETE!

  apply: function (text, patch) {
    text = text.split('')

    for (let i = 0; i < patch.length - 1; i++) {
      if (typeof patch[i + 1] === 'string') {
        text.splice(patch[i], 0, ...patch[++i])
      } else {
        if (typeof patch[i + 2] === 'string') {
          text.splice(patch[i], patch[i + 1], ...patch[i += 2])
        } else {
          text.splice(patch[i], patch[++i])
        }
      }
    }

    return text.join('')
  },

  // text1, diffs: Optimal
  // text1, text2: Compute diffs from text1 and text2.
  // diffs:        Compute text1 from diffs.

  make: function (source) {
    const sourcePatch = dmp.patch_make(source, arguments[1], arguments[2])
    let patch = []
    let prev_deleted_text_end = 0

    for (let i = 0; i < sourcePatch.length; i++) {
      let counter = sourcePatch[i].start1

      for (let d = 0; d < sourcePatch[i].diffs.length; d++) {
        let diff_type = sourcePatch[i].diffs[d][0]
        let diff_text = sourcePatch[i].diffs[d][1]

        switch (diff_type) {
          case 1:
            if (prev_deleted_text_end !== counter) {
              patch.push(counter)
            }
            patch.push(diff_text.toString())
            prev_deleted_text_end = 0
            break
          case -1:
            patch.push(counter)
            patch.push(diff_text.length)
            prev_deleted_text_end = counter
            break
        }

        if (diff_type !== -1) {
          counter += diff_text.length
        }
      }
    }

    return patch
  }
}

module.exports = micropatch

// CLI functions

// Apply patch:
// micropatch.js original_file < patch_file
// echo '[0,"patch_string"]' | micropatch.js original_file
// micropatch.js apply "old_string" "new_string"

// Make patch:
// micropatch.js old_file new_file
// micropatch.js make "old_string" "new_string"

switch (process.argv.length) {
  case 5:
    switch (process.argv[2]) {
      case 'make':
        console.log(JSON.stringify(micropatch.make(process.argv[3], process.argv[4])))
        break
      case 'apply':
        console.log(micropatch.apply(process.argv[3], JSON.parse(process.argv[4])))
        break
    }
    break
  case 4:
    try {
      const fs = require('fs')
      const file1 = fs.readFileSync(process.argv[2])
      const file2 = fs.readFileSync(process.argv[3])
      console.log(JSON.stringify(micropatch.make(file1.toString(), file2.toString())))
    } catch (err) {
      throw err
    }
    break
  case 2:
    const stdin = process.openStdin()
    let input = ''

    stdin.on('data', chunk => { input += chunk })

    stdin.on('end', () => {
      require('fs').readFile(process.argv[2], (err, file) => {
        if (err) throw err
        console.log(micropatch.apply(file.toString(), JSON.parse(input)))
      })
    })
    break
}
