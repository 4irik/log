# Валидация форм yii2 как в Laravel

![alt text](../assets/laravel-form-in-yii2/laryii2-form.png)

Сейчас работаю над проектом на `yii2` весь backend которого - REST-API.
Соответственно, там много форм и много шаблонного кода в действиях (`Action`):

```php
public function run(Request $request): FormName|ResponseName
{
    $form = new FormName();
    $form->load($request->getBodyParams());
    if (!$form->validate()) {
        return $form;
    }

    // ...

    return new ResponseName($data);
}
```

Надоело мне его писать каждый раз, а, кроме того, мне не нравится:
1) в сигнатуре ответа у нас два типа: форма, на случай если что-то передали не то, и, собственно, сам ответ;
2) код работы с формой сервисный, т.е. не несёт никакой смысловой нагрузки, а лишь только занимает место и отнимает время при чтении/написании

Хочется как в Laravel: если данные не прошли валидацию, то и метод контроллера не запустится.
Т.е. чтобы было как-то так:

```php
public function run(FormName $form): ResponseName
{
    // ...

    return new ResponseName($data);
}
```

Тут сразу в голову приходят `middleware` и метод `beforeAction`, но первыx в `yii2` не завезли а второй не подходит по причине отсутсвия возможности вернуть ответ из него пользователю кроме как кинуть исключение.

В голову пришли два варианта решения:

1) Сделать наследника от `Action`, переопределить у него метод `runWithParams` и все свои классы уже наследовать от него;
2) Подменить в автозагрузке класс `Action` на свой.

Первый вариант не особо подходит потому как придётся перелапатить весь проект, 
второй меня смущает тем что при обновлении фреймворка нужно будет внимательно посмотреть не поменяли ли там чего в классе `Action`, 
но, пока что, ничего лучше я не придумал (да и в первом варианте тоже просто так обновляться будет немного тревожно).

Второй путь выглядит так:

1) Копируем `yii\base\Action` в свою директорию (оставляем у него исходный namespace) и переписываем метод `runWithParams`:

```php
<?php

namespace yii\base;

use Yii;

class Action extends Component
{
    // ... 

    public function runWithParams($params)
    {
        if (!method_exists($this, 'run')) {
            throw new InvalidConfigException(get_class($this) . ' must define a "run()" method.');
        }
        $args = $this->controller->bindActionParams($this, $params);
        Yii::debug('Running action: ' . get_class($this) . '::run(), invoked by ' . get_class($this->controller), __METHOD__);
        if (Yii::$app->requestedParams === null) {
            Yii::$app->requestedParams = $args;
        }
        if ($this->beforeRun()) {
            $result = null;
            $request = Yii::$app->getRequest();
            foreach ($args as $value) {
                if ($value instanceof Model) {
                    $value->load(match ($request->getMethod()) {
                        'POST' => $request->getBodyParams(),
                        default => $request->getQueryParams()
                    });

                    if (!$value->validate()) {
                        $result = $value;
                        break;
                    }
                }
            }

            $result = is_null($result)
                ? call_user_func_array([$this, 'run'], $args)
                : $result;

            $this->afterRun();

            return $result;
        }

        return null;
    }

    // ... 
}
```

2) Подменяем в автозагрузке исходный класс на свой:

```php
// bootstrap.php

// ...

Yii::$classMap['yii\base\Action'] = __DIR__ . '/../component/Action.php';
```

3) Указываем в конфиге приложения, в разделе `components`, класс нашей формы (чтобы контейнер приложения смог создать объект формы, иначе он скажет что не знает таких):

```php
<?php

return [
    'components' => [
	// ...
        FormName::class => FormName::class,
    ],
]
```

На этом всё: если пришёл запрос, и форма не прошла валидацию, пользователь увидит ответ с ошибками, действие в контроллере не запустится, а мы не будем писать шаблонный код создания наполнения и валидации формы каждый раз. 

Happy end!