<?php

declare(strict_types=1);

use PHPUnit\Framework\Constraint\Constraint;
use PHPUnit\Framework\MockObject\MockObject;

trait MockCallSequenceTrait
{
    /**
     * Полная проверка всех вызовов по порядку.
     *
     * @param MockObject $mock
     * @param string $methodName
     * @param array  $calls   Формат: [ [ [arg1, arg2, ...], returnValue ], ... ]
     */
    public function expectCallSequence(MockObject $mock, string $methodName, array $calls): void
    {
        $callIndex = 0;

        $mock->expects($this->exactly(count($calls)))
            ->method($methodName)
            ->willReturnCallback(function (...$args) use (&$callIndex, $calls) {
                [$expectedArgs, $return] = array_pad($calls[$callIndex], 2, null);

                foreach ($expectedArgs as $i => $expectedArg) {
                    if ($expectedArg instanceof Constraint) {
                        $this->assertThat($args[$i], $expectedArg, "Аргумент #$i вызова #{$callIndex} не совпадает с ожиданием");
                    }
                    else {
                        $this->assertSame($expectedArg, $args[$i], "Аргумент #$i вызова #{$callIndex} не совпадает");
                    }
                }

                $callIndex++;
                return $return;
            });
    }

    /**
     * Проверяет только указанные вызовы (по номерам), остальные обрабатываются как $defaultCallback.
     *
     * @param MockObject    $mock
     * @param string        $methodName
     * @param array         $callsByIndex Массив: номер_вызова => [ [args], returnValue ]
     * @param callable|null $defaultCallback
     */
    public function expectPartialCallSequence(
        MockObject $mock,
        string $methodName,
        array $callsByIndex,
        ?callable $defaultCallback = null,
    ): void {
        $callIndex = 0;

        $mock->method($methodName)
            ->willReturnCallback(function (...$args) use (&$callIndex, $callsByIndex, $defaultCallback) {
                if (isset($callsByIndex[$callIndex])) {
                    [$expectedArgs, $return] = array_pad($callsByIndex[$callIndex], 2, null);

                    foreach ($expectedArgs as $i => $expectedArg) {
                        if ($expectedArg instanceof Constraint) {
                            $this->assertThat($args[$i], $expectedArg, "Аргумент #$i вызова #{$callIndex} не совпадает с ожиданием");
                        }
                        else {
                            $this->assertSame($expectedArg, $args[$i], "Аргумент #$i вызова #{$callIndex} не совпадает");
                        }
                    }

                    $callIndex++;
                    return $return;
                }

                $callIndex++;
                return $defaultCallback ? $defaultCallback(...$args) : null;
            });
    }
}
