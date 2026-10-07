[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem

$excelPath = "C:\Users\yaelg\Documents\Copy of Amal Band III Lists C-D updated 29072023.xlsx"
$outputPath = "c:\Users\yaelg\Documents\Antigravity Module E Vocabulary Practice\js\words-data.js"

if (-not (Test-Path $excelPath)) {
    Write-Error "Excel file not found at $excelPath"
    exit 1
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($excelPath)
$ssEntry = $zip.GetEntry("xl/sharedStrings.xml")
$reader = New-Object System.IO.StreamReader($ssEntry.Open(), [System.Text.Encoding]::UTF8)
[xml]$ssXml = $reader.ReadToEnd()
$reader.Close()

$strings = [System.Collections.Generic.List[string]]::new()
foreach ($si in $ssXml.sst.si) {
    $strings.Add($si.InnerText)
}

function ParseSheet($entryPath, $listLabel, $idPrefix) {
    $entry = $zip.GetEntry($entryPath)
    $r = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    [xml]$xml = $r.ReadToEnd()
    $r.Close()
    
    $items = [System.Collections.Generic.List[hashtable]]::new()
    $index = 1
    foreach ($row in $xml.worksheet.sheetData.row) {
        $rNum = [int]$row.r
        if ($rNum -le 5) { continue }
        
        $map = @{}
        foreach ($c in $row.c) {
            $col = $c.r -replace '\d+',''
            $v = ""
            if ($c.t -eq "s") {
                $idx = [int]$c.v
                $v = $strings[$idx]
            } else {
                $v = $c.InnerText
            }
            $map[$col] = $v
        }
        
        $w = if ($map.ContainsKey("A")) { $map["A"].Trim() } else { "" }
        if ($w -and $w -ne "Word" -and $w -ne "Entry" -and $w -ne "Phrasal verbs and chunks") {
            $translation = if ($map.ContainsKey("E")) { $map["E"].Trim() } else { "" }
            $meaning = if ($map.ContainsKey("D")) { $map["D"].Trim() } else { "" }
            $example = if ($map.ContainsKey("C")) { $map["C"].Trim() } else { "" }
            $pos = if ($map.ContainsKey("B")) { $map["B"].Trim() } else { "" }
            
            $items.Add(@{
                id = "$idPrefix-$index"
                word = $w
                pos = $pos
                example = $example
                meaning = $meaning
                translation = $translation
                list = $listLabel
            })
            $index++
        }
    }
    return $items
}

$listC = ParseSheet "xl/worksheets/sheet1.xml" "Band III - List C" "listc"
$listD = ParseSheet "xl/worksheets/sheet2.xml" "Band III - List D" "listd"
$zip.Dispose()

# Essential Band II words
$band2Words = @(
    @{ id = "b2-1"; word = "ability"; pos = "n"; example = "She has the ability to speak three languages fluently."; meaning = "The physical or mental power to do something."; translation = "יכולת"; list = "Band II - Core" },
    @{ id = "b2-2"; word = "achieve"; pos = "v"; example = "Hard work will help you achieve your goals."; meaning = "To succeed in reaching a desired objective."; translation = "להשיג / להגיע להישג"; list = "Band II - Core" },
    @{ id = "b2-3"; word = "advantage"; pos = "n"; example = "One advantage of living in the city is public transport."; meaning = "A condition or circumstance that puts one in a favorable position."; translation = "יתרון"; list = "Band II - Core" },
    @{ id = "b2-4"; word = "affect"; pos = "v"; example = "Climate change affects animals worldwide."; meaning = "To have an influence on or make a difference to."; translation = "להשפיע על"; list = "Band II - Core" },
    @{ id = "b2-5"; word = "alternative"; pos = "n/adj"; example = "We need to find an alternative route due to traffic."; meaning = "Another choice or option available."; translation = "חלופה / חלופי"; list = "Band II - Core" },
    @{ id = "b2-6"; word = "analyze"; pos = "v"; example = "The scientists analyze the data before making conclusions."; meaning = "To examine methodically and in detail."; translation = "לנתח"; list = "Band II - Core" },
    @{ id = "b2-7"; word = "approach"; pos = "n/v"; example = "The teacher has a creative approach to learning."; meaning = "A way of dealing with something."; translation = "גישה / לגשת אל"; list = "Band II - Core" },
    @{ id = "b2-8"; word = "appropriate"; pos = "adj"; example = "Please wear appropriate clothes for the formal event."; meaning = "Suitable or proper in the circumstances."; translation = "מתאים / הולם"; list = "Band II - Core" },
    @{ id = "b2-9"; word = "attitude"; pos = "n"; example = "A positive attitude helps in overcoming obstacles."; meaning = "A settled way of thinking or feeling."; translation = "גישה / עמדה"; list = "Band II - Core" },
    @{ id = "b2-10"; word = "benefit"; pos = "n/v"; example = "Regular exercise offers many health benefits."; meaning = "An advantage or profit gained from something."; translation = "תועלת / להועיל"; list = "Band II - Core" },
    @{ id = "b2-11"; word = "challenge"; pos = "n/v"; example = "Learning a new language is a fun challenge."; meaning = "A task or situation that tests someone's abilities."; translation = "אתגר / לאתגר"; list = "Band II - Core" },
    @{ id = "b2-12"; word = "community"; pos = "n"; example = "Volunteers help improve their local community."; meaning = "A group of people living in the same area or sharing common interests."; translation = "קהילה"; list = "Band II - Core" },
    @{ id = "b2-13"; word = "consequence"; pos = "n"; example = "Every action has a consequence."; meaning = "A result or effect of an action or condition."; translation = "תוצאה / השלכה"; list = "Band II - Core" },
    @{ id = "b2-14"; word = "constant"; pos = "adj"; example = "The baby requires constant attention."; meaning = "Occurring continuously over a period of time."; translation = "קבוע / תמידי"; list = "Band II - Core" },
    @{ id = "b2-15"; word = "contribute"; pos = "v"; example = "Many students contribute to charity projects."; meaning = "To give something in order to achieve a result."; translation = "לתרום"; list = "Band II - Core" },
    @{ id = "b2-16"; word = "crucial"; pos = "adj"; example = "Sleep is crucial for academic success."; meaning = "Decisive or critically important."; translation = "מכריע / חיוני ביותר"; list = "Band II - Core" },
    @{ id = "b2-17"; word = "decrease"; pos = "v/n"; example = "Prices are expected to decrease next month."; meaning = "To make or become smaller or fewer in size or amount."; translation = "להפחית / ירידה"; list = "Band II - Core" },
    @{ id = "b2-18"; word = "demonstrate"; pos = "v"; example = "The experiment demonstrates how pressure works."; meaning = "To clearly show the existence or truth of something."; translation = "להדגים / להראות"; list = "Band II - Core" },
    @{ id = "b2-19"; word = "determine"; pos = "v"; example = "Your choices today determine your future."; meaning = "To cause something to occur in a particular way; decide."; translation = "לקבוע / להכריע"; list = "Band II - Core" },
    @{ id = "b2-20"; word = "development"; pos = "n"; example = "Good nutrition is necessary for healthy child development."; meaning = "The process of developing, growing, or progressing."; translation = "התפתחות"; list = "Band II - Core" },
    @{ id = "b2-21"; word = "encourage"; pos = "v"; example = "Teachers encourage students to read more books."; meaning = "To give support, confidence, or hope."; translation = "לעודד"; list = "Band II - Core" },
    @{ id = "b2-22"; word = "environment"; pos = "n"; example = "We must protect the natural environment."; meaning = "The surroundings or conditions in which a person, animal, or plant lives."; translation = "סביבה"; list = "Band II - Core" },
    @{ id = "b2-23"; word = "essential"; pos = "adj"; example = "Water is essential for life."; meaning = "Absolutely necessary; extremely important."; translation = "חיוני / הכרחי"; list = "Band II - Core" },
    @{ id = "b2-24"; word = "evidence"; pos = "n"; example = "The police looked for evidence at the crime scene."; meaning = "Facts or information indicating whether a belief is true or valid."; translation = "ראיות / עדות"; list = "Band II - Core" },
    @{ id = "b2-25"; word = "experience"; pos = "n/v"; example = "She has great experience in teaching."; meaning = "Practical contact with and observation of facts or events."; translation = "ניסיון / לחוות"; list = "Band II - Core" },
    @{ id = "b2-26"; word = "factor"; pos = "n"; example = "Diet is a key factor in overall health."; meaning = "A circumstance, fact, or influence that contributes to a result."; translation = "גורם"; list = "Band II - Core" },
    @{ id = "b2-27"; word = "focus"; pos = "v/n"; example = "Please focus on answering the question accurately."; meaning = "To pay particular attention to something."; translation = "להתמקד / מיקוד"; list = "Band II - Core" },
    @{ id = "b2-28"; word = "frequently"; pos = "adv"; example = "Buses run frequently during rush hour."; meaning = "Regularly or often."; translation = "לעיתים קרובות"; list = "Band II - Core" },
    @{ id = "b2-29"; word = "generate"; pos = "v"; example = "Solar panels generate clean electricity."; meaning = "To cause something to arise or come into being."; translation = "לייצר / לחולל"; list = "Band II - Core" },
    @{ id = "b2-30"; word = "identify"; pos = "v"; example = "Can you identify the main idea of the passage?"; meaning = "To recognize and name someone or something."; translation = "לזהות"; list = "Band II - Core" }
)

$allWords = @($listC) + @($listD) + @($band2Words)

$lessons = [System.Collections.Generic.List[hashtable]]::new()
$lessonNum = 1

function CreateLessonBatches($items, $prefixTitle) {
    global:lessonNum
    $batchSize = 10
    $count = $items.Count
    for ($i = 0; $i -lt $count; $i += $batchSize) {
        $slice = $items[$i..([Math]::Min($i + $batchSize - 1, $count - 1))]
        $wordIds = $slice | ForEach-Object { $_.id }
        $wordNames = ($slice | ForEach-Object { $_.word }) -join ", "
        $lesson = @{
            id = "lesson-$lessonNum"
            lessonNumber = $lessonNum
            title = "Lesson $lessonNum: $prefixTitle ($($i+1)-$([Math]::Min($i + $batchSize, $count)))"
            category = $prefixTitle
            wordIds = $wordIds
            sampleWords = $wordNames
            count = $slice.Count
        }
        $lessons.Add($lesson)
        $lessonNum++
    }
}

CreateLessonBatches $band2Words "Band II Core"
CreateLessonBatches $listC "Band III List C"
CreateLessonBatches $listD "Band III List D"

$allWordsJson = ConvertTo-Json -InputObject $allWords -Depth 5 -Compress
$lessonsJson = ConvertTo-Json -InputObject $lessons -Depth 5 -Compress

$jsContent = @"
/**
 * Module E Bagrut Vocabulary Practice - Master Dataset
 * Extracted from official Amal Band III Lists C & D + Band II Core
 * Total vocabulary items: $($allWords.Count)
 * Total pre-built 10-word lessons: $($lessons.Count)
 */

window.MODULE_E_WORDS = $allWordsJson;

window.MODULE_E_LESSONS = $lessonsJson;

console.log("Module E vocabulary loaded: " + window.MODULE_E_WORDS.length + " words, " + window.MODULE_E_LESSONS.length + " lesson sets.");
"@

[System.IO.File]::WriteAllText($outputPath, $jsContent, [System.Text.Encoding]::UTF8)
Write-Output "Successfully generated $outputPath with $($allWords.Count) words and $($lessons.Count) lessons!"
