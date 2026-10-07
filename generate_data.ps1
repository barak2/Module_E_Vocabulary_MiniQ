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
    
    $items = [System.Collections.Generic.List[PSCustomObject]]::new()
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
            
            $items.Add([PSCustomObject]@{
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

$allWords = [System.Collections.Generic.List[PSCustomObject]]::new()
foreach ($item in $listC) { $allWords.Add($item) }
foreach ($item in $listD) { $allWords.Add($item) }

$lessons = [System.Collections.Generic.List[PSCustomObject]]::new()

function CreateLessonBatches($items, $prefixTitle, $slug) {
    $batchSize = 10
    $count = $items.Count
    $part = 1
    for ($i = 0; $i -lt $count; $i += $batchSize) {
        $endIdx = [Math]::Min($i + $batchSize - 1, $count - 1)
        $slice = $items[$i..$endIdx]
        $wordIds = @($slice | ForEach-Object { $_.id })
        $wordNames = ($slice | ForEach-Object { $_.word }) -join ", "
        $lesson = [PSCustomObject]@{
            id = "$($slug)-lesson-$($part)"
            lessonNumber = $part
            title = "$($prefixTitle): Part $($part) (Words $($i+1)-$($endIdx + 1))"
            category = $prefixTitle
            wordIds = $wordIds
            sampleWords = $wordNames
            count = $slice.Count
        }
        $lessons.Add($lesson)
        $part++
    }
}

CreateLessonBatches $listC "List C" "listc"
CreateLessonBatches $listD "List D" "listd"

$allWordsJson = ConvertTo-Json -InputObject $allWords -Depth 5 -Compress
$lessonsJson = ConvertTo-Json -InputObject $lessons -Depth 5 -Compress

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("/**")
[void]$sb.AppendLine(" * Module E Bagrut Vocabulary Practice - Master Dataset")
[void]$sb.AppendLine(" * Extracted from official Amal Band III Lists C & D")
[void]$sb.AppendLine(" * Total vocabulary items: $($allWords.Count)")
[void]$sb.AppendLine(" * Total pre-built 10-word lessons: $($lessons.Count)")
[void]$sb.AppendLine(" */")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("window.MODULE_E_WORDS = $allWordsJson;")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("window.MODULE_E_LESSONS = $lessonsJson;")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("console.log('Module E vocabulary loaded: ' + window.MODULE_E_WORDS.length + ' words, ' + window.MODULE_E_LESSONS.length + ' lesson sets.');")

[System.IO.File]::WriteAllText($outputPath, $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Output "Successfully generated $outputPath with $($allWords.Count) words and $($lessons.Count) lessons!"
