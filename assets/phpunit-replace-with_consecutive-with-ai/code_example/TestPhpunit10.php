<?php

require_once 'MockCallSequenceTrait.php';
require_once 'TestableClass.php';

class TestPhpunit10 extends PHPUnit\Framework\TestCase
{
    use MockCallSequenceTrait;
    
    /**
     * Ожидается ошибка/Expected error:
     * ```
     * 1) TestPhpunit10::testDoSomethingInvokesGreaterThanOnce
     * TestableClass::doSomething(2, '3'): string was not expected to be called more than once.
     * ```
     */
    public function testDoSomethingInvokingGreaterThanOnceFail()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $this->expectCallSequence($testableClass, 'doSomething', [
            [[1, '2'], '1 2',],
        ]);
    
        $this->assertEquals('1 2', $testableClass->doSomething(1, '2'));
        $testableClass->doSomething(2, '3');
    }

    public function testDoSomethingConsecutive()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $this->expectCallSequence($testableClass, 'doSomethingWithDefault', [
            [[1, '3'], '1 3',],
            [[3], '3 2',],
        ]);

        $this->assertEquals('1 3', $testableClass->doSomethingWithDefault(1, '3'));
        $this->assertEquals('3 2', $testableClass->doSomethingWithDefault(3));
    }

    public function testDoSomethingConsecutivePartial()
    {
        $testableClass = $this->createMock(TestableClass::class);
        $this->expectPartialCallSequence($testableClass, 'doSomethingWithDefault', [
            0 => [[1, '3'], '1 3',],
            2 => [[3], '3 2',],
        ], fn(): string => '');

        $this->assertEquals('1 3', $testableClass->doSomethingWithDefault(1, '3'));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(2));
        $this->assertEquals('3 2', $testableClass->doSomethingWithDefault(3));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(4));
        $this->assertEquals('', $testableClass->doSomethingWithDefault(5));
    }
}