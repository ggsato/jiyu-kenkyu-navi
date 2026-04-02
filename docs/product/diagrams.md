# 自由研究ナビ MVP / v1.x 補助図

この文書は、`docs/product/mvp-design.md` に書かれた現行仕様を、図で補助的に示すための文書である。  
現行仕様の正本は `docs/product/mvp-design.md` であり、この文書はその代わりではない。

## 1. ユースケース図

```mermaid
flowchart LR
    user[利用者]
    ai[AI]

    subgraph app[自由研究ナビ]
        uc1([願いを言葉にする])
        uc2([今いちばん気になることを書く<br/>任意])
        uc3([問い候補を得る])
        uc4([今育てる問いを選ぶ])
        uc5([観測骨格の中で<br/>今回注目する記録項目を整える])
        uc6([記録する])
        uc7([振り返る])
        uc8([次の一歩を決める])
        uc9([見方の地図を見返す])
        uc10([active な問いの途中で<br/>項目を追加・解除・見直しする])
    end

    user --> uc1
    user --> uc2
    user --> uc3
    user --> uc4
    user --> uc5
    user --> uc6
    user --> uc7
    user --> uc8
    user --> uc9
    user --> uc10

    ai -. 問いの芽を整える .-> uc3
    ai -. 初期項目案を提案する .-> uc5

    uc3 --> uc4
    uc4 --> uc5
    uc5 --> uc6
    uc6 --> uc7
    uc7 --> uc8
    uc9 --> uc5
    uc10 --> uc6
```

## 2. 画面責務図

```mermaid
flowchart TB
    subgraph usecases[主要アクション]
        a1[願いを書く]
        a2[問い候補を得る]
        a3[問いを選ぶ]
        a4[記録項目を整える]
        a5[記録する]
        a6[記録項目を後編集する]
        a7[振り返る]
        a8[次の一歩を決める]
        a9[観測骨格の構造を見返す]
        a10[家族内ユーザーや願いを切り替える]
    end

    subgraph screens[画面]
        s1[ホーム]
        s2[問い作成]
        s3[記録]
        s4[振り返り]
        s5[見方の地図]
        s6[家族設定]
    end

    s2 --> a1
    s2 --> a2
    s2 --> a3
    s2 --> a4

    s3 --> a5
    s3 --> a6

    s4 --> a7

    s1 --> a8
    s1 --> a9
    s1 --> a10

    s5 --> a9
    s5 --> a4

    s6 --> a10
```

## 3. クラス図

```mermaid
classDiagram
    class Family {
      +id
      +name
    }

    class User {
      +id
      +name
    }

    class FamilyMember {
      +familyId
      +userId
      +role
    }

    class Wish {
      +id
      +text
      +reason
      +currentState
      +notYet
      +desiredState
    }

    class Question {
      +id
      +text
      +status
      +purposeFocus
      +modeHint
    }

    class ObservationFieldDefinition {
      +id
      +key
      +label
      +type
      +role
      +why
      +howToUse
      +isDefault
      +sortOrder
    }

    class QuestionObservationFocus {
      +questionId
      +fieldDefinitionId
      +isSelected
      +sortOrder
    }

    class Record {
      +id
      +recordedAt
      +body
      +memo
      +kvFields
      +tags
    }

    class RecordAttachment {
      +id
      +storageKey
      +mimeType
      +fileSize
      +sortOrder
    }

    class Reflection {
      +id
      +reflectionDate
      +learned
      +unknown
      +nextStepText
      +selfProgressSignal
      +distanceDelta
    }

    Family "1" --> "0..*" FamilyMember : has
    User "1" --> "0..*" FamilyMember : belongs through
    User "1" --> "0..*" Wish : has
    Wish "1" --> "0..*" Question : grows into
    Wish "1" --> "0..*" ObservationFieldDefinition : owns
    Question "1" --> "0..*" Record : accumulates
    Record "1" --> "0..*" RecordAttachment : has
    Question "1" --> "0..*" Reflection : reviewed by day
    Question "1" --> "0..*" QuestionObservationFocus : focuses
    ObservationFieldDefinition "1" --> "0..*" QuestionObservationFocus : selected in
```

## 4. ObservationFieldDefinition の細分化表現案

`ObservationFieldDefinition` の親子関係は、GitHub 上の `classDiagram` では自己関連の描画が崩れることがある。  
そのため、自己関連を強調したい場合は次の代替表現を使う。

### 4.1 flowchart で表す案

```mermaid
flowchart TD
    parent[親項目<br/>ObservationFieldDefinition]
    child1[細分化項目 A<br/>ObservationFieldDefinition]
    child2[細分化項目 B<br/>ObservationFieldDefinition]

    parent -->|derived into| child1
    parent -->|derived into| child2
```

### 4.2 erDiagram で表す案

```mermaid
erDiagram
    OBSERVATION_FIELD_DEFINITION ||--o{ OBSERVATION_FIELD_DERIVATION : parent
    OBSERVATION_FIELD_DEFINITION ||--o{ OBSERVATION_FIELD_DERIVATION : child

    OBSERVATION_FIELD_DEFINITION {
        string id
        string key
        string label
        string type
    }

    OBSERVATION_FIELD_DERIVATION {
        string parentFieldId
        string childFieldId
    }
```

## 5. C4 風の概要図

```mermaid
flowchart TB
    user[利用者]

    subgraph system[自由研究ナビ]
        web[Next.js Web App<br/>画面と API]
        db[(PostgreSQL<br/>Wish / Question / Record / Reflection / Observation Fields)]
        uploads[(画像保存<br/>public/uploads)]
    end

    ai[OpenAI API]

    user -->|ブラウザで利用| web
    web -->|読み書き| db
    web -->|画像保存・取得| uploads
    web -->|問い候補・記録項目候補・ホーム要約の生成| ai
```

## 6. 補足

- ユースケース図では、AI は問いや記録項目の作者ではなく、整える補助役として表現している
- 画面責務図は画面遷移図ではなく、どの画面がどの責務を持つかを示す
- クラス図は実装上の全属性一覧ではなく、現行仕様の理解に必要な中心構造へ絞っている
- `ObservationFieldDefinition` の親子関係は GitHub 上の Mermaid 描画安定性を優先し、クラス図本体からは外して別図で補っている
- C4 風の概要図は MVP の把握を優先した簡略版である
